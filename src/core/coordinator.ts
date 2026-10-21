import type { CallOptions, Consumer, ExecutionResult, ModelIdentity, Run, StopReason, Usage } from "./contracts.js";
import { ExecutionControls } from "./controls.js";
import { errorCode, requireThat } from "./errors.js";
import { BOUNDS, identity, jsonBytes, parseContinue, parseResults, parseSubmit } from "./validation.js";
import { FairScheduler, InvocationScope, monotonicClock, type Clock } from "./scheduler.js";
import { Workspaces, type Batch } from "./workspaces.js";
import { RetainedMemory } from "./memory.js";
import { ResultPages, recordUsage, sumUsage } from "./results.js";
import type { ClassifierAdapter, NativeOutcome } from "../pi/classifier-adapter.js";

export interface ChargedUnits { requests: number; inputBytes: number }
/** Internal bridge only; null requires a conservative parent stop, never a fresh allowance. */
export interface ManagedExecutionResult extends ExecutionResult { charged: ChargedUnits | null; batchId?: string }

/** The sole owner of ephemeral work and scheduling. Library facades never construct this. */
export class Coordinator {
  readonly memory = new RetainedMemory();
  readonly workspaces = new Workspaces(this.memory);
  readonly pages = new ResultPages();
  readonly scheduler: FairScheduler;
  #runs = new Set<InvocationScope>();
  #drains = new Map<InvocationScope, Promise<void>>();
  #reuse = new Map<string, { batchId: string; index: number }>();
  #expired = false;
  #charged = new WeakMap<ExecutionResult, ChargedUnits>();
  #batchIds = new WeakMap<ExecutionResult, string>();
  #uncertain = new WeakSet<ExecutionResult>();
  constructor(readonly controls: ExecutionControls, readonly classifier: ClassifierAdapter,
    private readonly clock: Clock = monotonicClock) {
    this.scheduler = new FairScheduler(() => controls.limits.concurrency);
  }
  #live(): void { requireThat(!this.#expired, "runtime_expired"); }
  #failure(error: unknown): ExecutionResult {
    const code = errorCode(error, "invalid_input");
    return { data: { ok: false, error: { code, message: code } } };
  }
  async submit(raw: unknown, consumer: Consumer = "library", options: CallOptions = {}, requiredModel?: ModelIdentity): Promise<ExecutionResult> {
    let batch: Batch | undefined;
    try {
      this.#live(); const input = parseSubmit(raw), model = this.controls.authorize(consumer, requiredModel);
      if (input.run) this.controls.invocation(input.run);
      batch = this.workspaces.prepare(input, model);
      return input.run ? await this.#execute(batch, input.run, [], consumer, options) : this.#result(batch);
    } catch (error) { return batch ? this.#result(batch, undefined, errorCode(error, "invalid_input")) : this.#failure(error); }
  }
  #managed(result: ExecutionResult): ManagedExecutionResult {
    // A failed reservation write/read-back may have created liability without returning its ID.
    const uncertain = this.#uncertain.has(result) || (!result.data.ok && result.data.error.code === "storage_error");
    const batchId = this.#batchIds.get(result);
    return { ...result, charged: uncertain ? null : { ...(this.#charged.get(result) ?? { requests: 0, inputBytes: 0 }) },
      ...(batchId ? { batchId } : {}) };
  }
  async submitManaged(raw: unknown, consumer: Consumer, options: CallOptions = {}, requiredModel?: ModelIdentity): Promise<ManagedExecutionResult> {
    return this.#managed(await this.submit(raw, consumer, options, requiredModel));
  }
  async continueManaged(raw: unknown, consumer: Consumer, options: CallOptions = {}): Promise<ManagedExecutionResult> {
    return this.#managed(await this.continue(raw, consumer, options));
  }
  results(raw: unknown): ExecutionResult {
    try {
      this.#live(); const input = parseResults(raw), batch = this.workspaces.get(input.batchId);
      return { data: { ok: true, value: this.pages.page(batch, this.controls.ledger.snapshot().totals, input.cursor, input.limit) } };
    } catch (error) { return this.#failure(error); }
  }
  async continue(raw: unknown, consumer: Consumer = "library", options: CallOptions = {}): Promise<ExecutionResult> {
    try {
      this.#live(); const input = parseContinue(raw), batch = this.workspaces.get(input.batchId);
      requireThat(!batch.busy, "batch_busy"); requireThat(input.expectedIdentity === batch.identity, "identity_mismatch");
      const retries: number[] = [];
      for (const id of input.retryFailedIds ?? []) {
        const index = batch.outcomes.findIndex(o => o.id === id), outcome = batch.outcomes[index];
        requireThat(outcome?.status === "failed" && outcome.error.retryEligible &&
          outcome.attempts < 1 + this.controls.limits.maxRetries, "invalid_retry_selection");
        retries.push(index);
      }
      return await this.#execute(batch, input.run, retries, consumer, options);
    } catch (error) { return this.#failure(error); }
  }
  #result(batch: Batch, usageDelta?: Usage, code?: string): ExecutionResult {
    const error = code ? { code, message: code } : undefined;
    let result: ExecutionResult;
    try {
      const page = this.pages.page(batch, this.controls.ledger.snapshot().totals, undefined, 20, error);
      result = { data: error ? { ok: false, error, batch: page } : { ok: true, value: page } };
    } catch (failure) { result = this.#failure(failure); }
    if (usageDelta) result.usageDelta = usageDelta;
    this.#batchIds.set(result, batch.id);
    if (code === "storage_error") this.#uncertain.add(result);
    return result;
  }
  #reuseKey(batch: Batch, index: number): string {
    const item = batch.input.items[index]!;
    return identity({ state: item.state, inputVersion: item.inputVersion, questions: batch.input.questions,
      rubricVersion: batch.input.rubricVersion, abstainChoices: batch.input.abstainChoices ?? {},
      model: batch.model, contractVersion: 1 });
  }
  async #execute(batch: Batch, run: Run, retries: number[], consumer: Consumer, options: CallOptions): Promise<ExecutionResult> {
    const budget = this.controls.invocation(run);
    this.controls.ready(consumer, batch.model);
    this.workspaces.acquire(batch.id);
    const scope = new InvocationScope(budget.maxWorkMs, options.signal, this.clock);
    this.#runs.add(scope);
    let drained!: () => void;
    this.#drains.set(scope, new Promise<void>(resolve => { drained = resolve; }));
    const pending = batch.outcomes.flatMap((o, i) => o.status === "pending" ? [i] : []);
    pending.push(...retries);
    let halt = false, failure: string | undefined, usageDelta: Usage | undefined;
    batch.stopReason = "complete";
    const stop = (code: string) => {
      halt = true;
      if (failure === "storage_error" && code !== "storage_error") return;
      const reasons: StopReason[] = ["call_limit", "budget_exhausted", "deadline", "cancelled", "disabled",
        "model_policy_mismatch", "storage_error", "persistence_required", "model_unavailable"];
      batch.stopReason = reasons.includes(code as StopReason) ? code as StopReason : "call_limit";
      if (!["call_limit", "budget_exhausted", "deadline", "cancelled", "disabled", "model_policy_mismatch"].includes(code)) failure = code;
      if (code === "storage_error") this.disable();
    };
    const checkTime = () => {
      if (scope.elapsedMs >= budget.maxWorkMs) scope.abort("deadline");
      if (scope.signal.aborted) { stop(scope.reason ?? "cancelled"); return false; }
      return !halt;
    };
    const attempt = async (index: number) => {
      if (!checkTime()) return;
      let growth: string | undefined, attemptId: string | undefined, dispatched = false;
      try {
        // Native availability is async. No reservation is committed until it finishes.
        const model = await this.classifier.resolve(batch.model);
        if (!checkTime()) return;
        this.controls.ready(consumer, batch.model);
        const key = this.#reuseKey(batch, index), cached = this.#reuse.get(key);
        if (cached) {
          const source = this.workspaces.get(cached.batchId).outcomes[cached.index];
          if (source?.status === "completed") {
            growth = this.workspaces.reserveAnswer(batch.id, jsonBytes(source.answers, BOUNDS.answerBytes));
            this.workspaces.completeAnswer(growth, index, source.answers, "reuse", source.judgmentId);
            batch.diagnostics.cacheHits++; this.#reuse.set(key, { batchId: batch.id, index }); return;
          }
        }
        growth = this.workspaces.reserveAnswer(batch.id);
        const item = batch.input.items[index]!;
        const bytes = jsonBytes({ state: item.state, questions: batch.input.questions }, BOUNDS.itemBytes);
        attemptId = this.controls.reserve(consumer, batch.model, bytes, budget);
        const timer = scope.attempt(this.controls.limits.maxAttemptMs);
        let native: NativeOutcome;
        try {
          this.controls.beforeDispatch(consumer, batch.model, attemptId, scope.signal);
          dispatched = true;
          const previous = batch.outcomes[index]!;
          batch.outcomes[index] = { id: previous.id, inputVersion: previous.inputVersion, status: "running", attempts: previous.attempts + 1 };
          batch.diagnostics.attempts++;
          native = await this.classifier.invoke(model, item.state, batch.input.questions, timer.signal, this.controls.limits.maxAttemptMs)
            .catch(() => ({ outcome: "failed" as const, code: "provider_error", retryEligible: false,
              automaticRetry: false, usage: null, pricing: "unknown" as const, provider: model.provider, model: model.id }));
        } finally { timer.dispose(); }
        const current = batch.outcomes[index]!;
        const remaining = current.attempts < 1 + this.controls.limits.maxRetries;
        if (native.usage) usageDelta = sumUsage(usageDelta, native.usage);
        else batch.diagnostics.unknownUsageAttempts++;
        recordUsage(batch.usage, native.provider, native.model, native.usage, native.pricing);
        if (native.outcome === "answered" && native.answers) {
          this.workspaces.completeAnswer(growth, index, native.answers);
          this.#reuse.set(key, { batchId: batch.id, index });
        } else {
          batch.outcomes[index] = { id: current.id, inputVersion: current.inputVersion, attempts: current.attempts,
            status: "failed", error: { code: native.code ?? "provider_error", retryEligible: native.retryEligible && remaining } };
        }
        this.controls.ledger.settle(attemptId, native.outcome, native.usage, native.pricing);
        if (native.automaticRetry && remaining && checkTime()) pending.push(index);
      } catch (error) {
        const code = errorCode(error, "model_unavailable");
        if (attemptId && !dispatched) {
          try { this.controls.ledger.releaseUndispatched(attemptId); budget.requests--;
            budget.inputBytes -= jsonBytes({ state: batch.input.items[index]!.state, questions: batch.input.questions }); }
          catch { stop("storage_error"); }
        }
        if (dispatched && batch.outcomes[index]?.status === "running") {
          const current = batch.outcomes[index]!;
          batch.outcomes[index] = { id: current.id, inputVersion: current.inputVersion, attempts: current.attempts,
            status: "failed", error: { code, retryEligible: false } };
        }
        if (!failure) stop(code);
      } finally { if (growth) this.workspaces.discardAnswer(growth); }
    };
    const worker = async () => {
      while (checkTime()) {
        const index = pending.shift(); if (index === undefined) return;
        try { await this.scheduler.enqueue(batch.id, () => attempt(index), scope.signal); }
        catch (error) { stop(scope.reason ?? errorCode(error, "cancelled")); }
      }
    };
    try { await Promise.all(Array.from({ length: Math.min(pending.length, this.controls.limits.concurrency) }, worker)); }
    finally {
      if (scope.signal.aborted) stop(scope.reason ?? "cancelled");
      batch.diagnostics.elapsedMs += scope.elapsedMs;
      scope.dispose(); this.#runs.delete(scope); this.workspaces.finish(batch.id);
      this.#drains.delete(scope); drained();
    }
    const result = this.#result(batch, usageDelta, failure);
    this.#charged.set(result, { requests: budget.requests, inputBytes: budget.inputBytes });
    return result;
  }
  disable(): void { this.controls.disable(); for (const run of this.#runs) run.abort("disabled"); }
  release(batchId: string): void {
    this.#live(); this.workspaces.release(batchId); this.pages.release(batchId);
    for (const [key, cached] of this.#reuse) if (cached.batchId === batchId) this.#reuse.delete(key);
  }
  clear(): void { this.workspaces.clear(); this.pages.clear(); this.#reuse.clear(); }
  async drain(): Promise<void> { await Promise.all(this.#drains.values()); }
  async expire(): Promise<void> { this.disable(); this.#expired = true; await this.drain(); this.clear(); }
}
