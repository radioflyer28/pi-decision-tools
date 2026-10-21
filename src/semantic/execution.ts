import type { SourceHooks } from "../filesystem/source.js";
import { FileEvidenceCapturer, type CapturedScope } from "../filesystem/capture.js";
import { prepareSearch } from "./preparation.js";
import { qualifies } from "./views.js";
import { parseSearch } from "./validation.js";
import type { CallOptions, Run, Usage, UsageGroup } from "../core/contracts.js";
import type { Coordinator } from "../core/coordinator.js";
import { errorCode, requireThat, ToolkitError } from "../core/errors.js";
import { InvocationScope, monotonicClock, type Clock } from "../core/scheduler.js";
import { recordUsage, sumUsage } from "../core/results.js";
import { SemanticParents } from "./parents.js";
import { prepareFilter } from "./preparation.js";
import { parseFilter, parseSemanticContinue, SEMANTIC_BOUNDS } from "./validation.js";
import type { SemanticPage } from "./schemas.js";

export interface ParentExecution { operationId: string; usageDelta?: Usage; error?: string }
export class SemanticExecution {
  readonly parents: SemanticParents;
  #open = true;
  #expired = false;
  #runs = new Map<InvocationScope, Promise<void>>();
  #capturer: FileEvidenceCapturer | undefined;
  #preparing = 0;
  constructor(readonly core: Coordinator, private readonly clock: Clock = monotonicClock,
    files?: { root: string; fileExclusions?: readonly string[]; hooks?: SourceHooks }) {
    this.parents = new SemanticParents(core);
    if (files) this.#capturer = new FileEvidenceCapturer(files.root, core.memory, files.fileExclusions ?? [], files.hooks);
  }
  async search(raw: unknown, options: CallOptions = {}): Promise<ParentExecution> {
    const started = this.clock.now(); this.#gate();
    const input = parseSearch(raw), model = this.core.controls.authorize("semantic");
    const workMs = input.run ? this.core.controls.invocation(input.run).maxWorkMs : this.core.controls.limits.maxWorkMs;
    requireThat(this.#capturer, "source_unverifiable");
    requireThat(this.parents.size + this.#preparing < SEMANTIC_BOUNDS.parents, "workspace_full");
    const scope = new InvocationScope(Math.max(0, workMs - (this.clock.now() - started)), options.signal, this.clock);
    let drained!: () => void;
    this.#runs.set(scope, new Promise<void>(resolve => { drained = resolve; }));
    this.#preparing++;
    let capture: CapturedScope | undefined, preparing = true;
    try {
      requireThat(!scope.signal.aborted, scope.reason ?? "cancelled");
      capture = await this.#capturer.capture(input.scope, scope.signal);
      this.#gate();
      requireThat(!scope.signal.aborted, scope.reason ?? "cancelled");
      const parent = this.parents.admit(prepareSearch(input, model, capture), capture);
      capture = undefined; this.#preparing--; preparing = false;
      return input.run ? await this.#execute(parent.id, input.run, [], { ...options, signal: scope.signal }, started, scope) : { operationId: parent.id };
    } catch (error) {
      if (errorCode(error) === "cancelled" && scope.reason) throw new ToolkitError(scope.reason);
      throw error;
    } finally {
      try { capture?.release(); }
      finally {
        if (preparing) this.#preparing--;
        scope.dispose(); this.#runs.delete(scope); drained();
      }
    }
  }
  #live(): void { requireThat(!this.#expired, "runtime_expired"); }
  #gate(): void { this.#live(); requireThat(this.#open, "disabled"); }
  async filter(raw: unknown, options: CallOptions = {}): Promise<ParentExecution> {
    const started = this.clock.now(); this.#gate();
    const input = parseFilter(raw), model = this.core.controls.authorize("semantic");
    if (input.run) this.core.controls.invocation(input.run);
    requireThat(this.parents.size + this.#preparing < SEMANTIC_BOUNDS.parents, "workspace_full");
    const parent = this.parents.admit(prepareFilter(input, model));
    return input.run ? this.#execute(parent.id, input.run, [], options, started) : { operationId: parent.id };
  }
  async continue(raw: unknown, options: CallOptions = {}): Promise<ParentExecution> {
    const started = this.clock.now(); this.#gate();
    const input = parseSemanticContinue(raw), parent = this.parents.get(input.operationId);
    requireThat(!parent.busy, "search_busy");
    requireThat(input.targetMatches === undefined || parent.discovery !== undefined);
    requireThat(input.expectedIdentity === parent.prepared.identity, "identity_mismatch");
    this.core.controls.invocation(input.run);
    const retries = input.retryFailedEvidenceIds ?? [];
    // Validate every selected record across all children before revision, dispatch, or counters change.
    for (const id of retries) {
      const outcome = parent.outcomes.find(o => o.id === id);
      requireThat(outcome?.status === "failed" && outcome.error.retryEligible &&
        outcome.attempts < 1 + this.core.controls.limits.maxRetries, "invalid_retry_selection");
    }
    return this.#execute(parent.id, input.run, retries, options, started, undefined, input.targetMatches);
  }
  async #execute(id: string, run: Run, retries: string[], options: CallOptions, started: number, acquisition?: InvocationScope, targetMatches?: number): Promise<ParentExecution> {
    const budget = this.core.controls.invocation(run), parent = this.parents.acquire(id);
    const scope = new InvocationScope(Math.max(0, budget.maxWorkMs - (this.clock.now() - started)), options.signal, this.clock);
    let drained!: () => void;
    this.#runs.set(scope, new Promise<void>(resolve => { drained = resolve; }));
    let requests = 0, inputBytes = 0, usageDelta: Usage | undefined, failure: string | undefined;
    const remainingRetries = new Set(retries);
    const completedBefore = new Set(parent.outcomes.filter(o => o.status === "completed").map(o => o.id));
    const capture = () => {
      const current = this.parents.capture(id);
      if (current.discovery) this.parents.update(id, { discovery: { ...current.discovery,
        latestJudgedIds: current.outcomes.filter(o => o.status === "completed" && !completedBefore.has(o.id)).map(o => o.id) } });
      return this.parents.get(id);
    };
    const stop = (code: string) => {
      // Only an owned acquisition scope can refine cancellation; never trust caller signal reasons.
      if (code === "cancelled" && acquisition?.reason) code = acquisition.reason;
      const reasons: SemanticPage["stopReason"][] = ["prepared", "complete", "call_limit", "budget_exhausted", "deadline", "cancelled", "disabled",
        "model_policy_mismatch", "storage_error", "persistence_required", "model_unavailable", "workspace_full", "target_reached"];
      this.parents.update(id, { stopReason: reasons.includes(code as SemanticPage["stopReason"]) ? code as SemanticPage["stopReason"] : "call_limit" });
    };
    const time = () => Math.floor(budget.maxWorkMs - (this.clock.now() - started));
    try {
      this.parents.update(id, { stopReason: "complete", ...(parent.discovery ? { discovery: {
        targetMatches: targetMatches ?? parent.discovery.targetMatches, latestJudgedIds: [] } } : {}) });
      while (true) {
        this.#gate();
        this.core.controls.ready("semantic", parent.prepared.model);
        if (time() <= 0) scope.abort("deadline");
        if (scope.signal.aborted) { stop(scope.reason ?? "cancelled"); break; }
        let current = this.parents.get(id);
        if (current.discovery) {
          const work = current.outcomes.some(o => o.status === "pending" || remainingRetries.has(o.id));
          if (!work) break;
          const latest = new Set(current.discovery.latestJudgedIds);
          const matched = current.outcomes.filter(o => latest.has(o.id) && qualifies(o, current.prepared.policy)).length;
          if (matched >= current.discovery.targetMatches) {
            // An exhausted allowance must not be disguised as a relevance yield.
            const totals = this.core.controls.ledger.snapshot().totals;
            if (requests >= budget.maxRequests || inputBytes >= budget.maxInputBytes) stop("call_limit");
            else if (totals.remainingRequests === 0 || totals.remainingInputBytes === 0) stop("budget_exhausted");
            else stop("target_reached");
            break;
          }
        }
        let child = current.children.find(c => current.outcomes.slice(c.start, c.start + c.count)
          .some(o => o.status === "pending" || remainingRetries.has(o.id)));
        if (!child) {
          const last = current.children.at(-1), preparedCount = last ? last.start + last.count : 0;
          if (preparedCount === current.prepared.records.length) break;
          child = await this.parents.prepareChild(id);
        }
        this.#gate(); this.core.controls.ready("semantic", parent.prepared.model);
        const maxWorkMs = time();
        if (maxWorkMs <= 0) scope.abort("deadline");
        if (scope.signal.aborted) { stop(scope.reason ?? "cancelled"); break; }
        current = this.parents.get(id);
        const selected = current.outcomes.slice(child.start, child.start + child.count).filter(o => remainingRetries.has(o.id)).map(o => o.id);
        const result = await this.core.continueManaged({ batchId: child.batchId, expectedIdentity: child.identity,
          retryFailedIds: selected, run: { maxRequests: budget.maxRequests - requests,
            maxInputBytes: budget.maxInputBytes - inputBytes, maxWorkMs } }, "semantic", { signal: scope.signal });
        if (result.usageDelta) usageDelta = sumUsage(usageDelta, result.usageDelta);
        capture();
        this.parents.retireSettled(id);
        for (const selectedId of selected) remainingRetries.delete(selectedId);
        if (result.charged === null) { failure = "storage_error"; stop(failure); break; }
        requests += result.charged.requests; inputBytes += result.charged.inputBytes;
        requireThat(requests <= budget.maxRequests && inputBytes <= budget.maxInputBytes, "accounting_error");
        if (!result.data.ok) { failure = result.data.error.code; stop(failure); break; }
        if (result.data.value.stopReason !== "complete") { stop(scope.reason ?? result.data.value.stopReason); break; }
      }
    } catch (error) { failure = errorCode(error, "invalid_input"); stop(failure); }
    finally {
      try {
        const current = capture(), usage: UsageGroup[] = structuredClone(current.retiredUsage ?? []);
        let { attempts, cacheHits, unknownUsageAttempts } = current.retiredDiagnostics ?? { attempts: 0, cacheHits: 0, unknownUsageAttempts: 0 };
        for (const child of current.children) {
          if (child.retired) continue;
          const batch = this.core.workspaces.get(child.batchId);
          attempts += batch.diagnostics.attempts; cacheHits += batch.diagnostics.cacheHits; unknownUsageAttempts += batch.diagnostics.unknownUsageAttempts;
          for (const group of batch.usage) recordUsage(usage, group.provider, group.model, group.usage, group.pricing);
        }
        this.parents.update(id, { usage, diagnostics: { attempts, cacheHits, unknownUsageAttempts,
          elapsedMs: parent.diagnostics.elapsedMs + Math.max(0, this.clock.now() - started) } });
      } finally {
        try { this.parents.finish(id); }
        finally { scope.dispose(); this.#runs.delete(scope); drained(); }
      }
    }
    return { operationId: id, ...(usageDelta ? { usageDelta } : {}), ...(failure ? { error: failure } : {}) };
  }
  open(): void { this.#live(); this.#open = true; }
  pause(): void { this.#open = false; this.parents.cancelReads(); for (const scope of this.#runs.keys()) scope.abort("disabled"); }
  async drain(): Promise<void> { await Promise.all([...this.#runs.values(), this.parents.drainReads()]); }
  async expire(): Promise<void> { this.#expired = true; this.pause(); this.parents.closeReads(); await this.drain(); this.parents.clear(); }
}
