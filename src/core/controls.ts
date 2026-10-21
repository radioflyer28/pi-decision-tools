import type { Configuration, Consumer, Limits, ModelIdentity, ModelKey, Run } from "./contracts.js";
import type { SessionLedger } from "../pi/session-adapter.js";
import { requireThat } from "./errors.js";
import { identity, integer, parseLimits, parseRun } from "./validation.js";

export interface AvailableModel extends ModelKey { api: string; baseUrl?: string }
export interface InvocationBudget { maxRequests: number; maxInputBytes: number; maxWorkMs: number; requests: number; inputBytes: number }
const sameKey = (a: ModelKey, b: ModelKey) => a.provider === b.provider && a.id === b.id;
export function pinModel(model: AvailableModel): ModelIdentity {
  return { provider: model.provider, id: model.id, api: model.api, backendVersionKnown: false,
    configurationFingerprint: identity({ api: model.api, baseUrl: model.baseUrl ?? null }) };
}
/** A UI wrapper may resolve ambiguity with a picker, then pass the explicit key. */
export function selectModel(models: readonly AvailableModel[], explicit?: ModelKey, saved?: ModelKey): AvailableModel {
  if (explicit) {
    const found = models.find(m => sameKey(m, explicit));
    requireThat(found, "model_unavailable"); return found;
  }
  const fallback = saved && models.find(m => sameKey(m, saved));
  if (fallback) return fallback;
  requireThat(models.length > 0, "model_unavailable");
  requireThat(models.length === 1, "model_ambiguous");
  return models[0]!;
}
function within(requested: Limits, frozen: Limits): void {
  for (const key of Object.keys(frozen) as (keyof Limits)[])
    requireThat(requested[key] <= frozen[key], "limit_exceeds_user");
}

/** Owner-only user controls. No enable/replenish capability is exported by Client. */
export class ExecutionControls {
  #enabled = false;
  #selected: ModelKey | undefined;
  #limits: Limits;
  #families: Configuration["families"];
  #default: ModelKey | undefined;
  constructor(readonly ledger: SessionLedger, private readonly available: () => readonly AvailableModel[],
    configuration: Configuration, private readonly stop: () => void = () => {}) {
    this.#limits = parseLimits(configuration.limits);
    this.#families = structuredClone(configuration.families);
    this.#default = configuration.defaultModel && { ...configuration.defaultModel };
  }
  get enabled(): boolean { return this.#enabled && !this.ledger.faulted; }
  get limits(): Limits { return { ...this.#limits }; }
  get families(): Configuration["families"] { return { ...this.#families }; }
  get selected(): ModelKey | undefined { return this.#selected && { ...this.#selected }; }
  enable(explicit?: ModelKey, limits: Limits = this.#limits): ModelIdentity {
    requireThat(!this.ledger.faulted, "storage_error");
    const next = parseLimits(limits);
    const frozen = this.ledger.snapshot().policy;
    if (frozen) within(next, frozen);
    const model = selectModel(this.available(), explicit ?? this.#selected, this.#default);
    this.#limits = next; this.#selected = { provider: model.provider, id: model.id }; this.#enabled = true;
    return pinModel(model);
  }
  disable(): void { this.#enabled = false; this.stop(); }
  select(explicit: ModelKey): ModelIdentity {
    const model = selectModel(this.available(), explicit);
    this.#selected = { provider: model.provider, id: model.id };
    return pinModel(model);
  }
  authorize(consumer: Consumer, pinned?: ModelIdentity): ModelIdentity {
    requireThat(!this.ledger.faulted, "storage_error");
    requireThat(this.#enabled, "disabled");
    requireThat(consumer === "library" || this.#families[consumer], "family_disabled");
    requireThat(this.#selected, "model_unavailable");
    const current = pinModel(selectModel(this.available(), this.#selected));
    if (pinned) requireThat(identity(current) === identity(pinned), "model_policy_mismatch");
    return current;
  }
  ready(consumer: Consumer, pinned?: ModelIdentity): ModelIdentity {
    const current = this.authorize(consumer, pinned);
    try {
      const state = this.ledger.read();
      if (!state.policy) this.ledger.grant(this.#limits.requests, this.#limits.inputBytes, this.#limits, true);
      else within(this.#limits, state.policy);
    } catch (error) {
      if (this.ledger.faulted) this.disable();
      throw error;
    }
    return current;
  }
  invocation(run: Run): InvocationBudget {
    const parsed = parseRun(run);
    const maxRequests = parsed.maxRequests ?? this.#limits.requests;
    const maxInputBytes = parsed.maxInputBytes ?? this.#limits.inputBytes;
    const maxWorkMs = parsed.maxWorkMs ?? this.#limits.maxWorkMs;
    requireThat(maxRequests <= this.#limits.requests && maxInputBytes <= this.#limits.inputBytes &&
      maxWorkMs <= this.#limits.maxWorkMs, "limit_exceeds_user");
    return { maxRequests, maxInputBytes, maxWorkMs, requests: 0, inputBytes: 0 };
  }
  reserve(consumer: Consumer, pinned: ModelIdentity, bytes: number, budget: InvocationBudget): string {
    integer(bytes);
    this.ready(consumer, pinned);
    requireThat(budget.requests < budget.maxRequests && bytes <= budget.maxInputBytes - budget.inputBytes, "call_limit");
    const totals = this.ledger.snapshot().totals;
    requireThat(totals.remainingRequests >= 1 && bytes <= totals.remainingInputBytes, "budget_exhausted");
    try {
      const id = this.ledger.reserve(bytes, pinned.provider, pinned.id);
      budget.requests++; budget.inputBytes += bytes;
      return id;
    } catch (error) { if (this.ledger.faulted) this.disable(); throw error; }
  }
  beforeDispatch(consumer: Consumer, pinned: ModelIdentity, attemptId: string, signal?: AbortSignal): void {
    requireThat(!signal?.aborted, "cancelled");
    this.ready(consumer, pinned);
    try { this.ledger.markDispatched(attemptId); }
    catch (error) { if (this.ledger.faulted) this.disable(); throw error; }
  }
  replenish(requests: number, inputBytes: number): void {
    integer(requests); integer(inputBytes);
    const state = this.ledger.read();
    // Existing disabled sessions can replenish without reauthorizing execution.
    if (!state.policy) {
      requireThat(this.#enabled, "disabled");
      this.ledger.grant(this.#limits.requests, this.#limits.inputBytes, this.#limits, true);
    }
    const current = this.ledger.snapshot();
    integer(current.totals.grantedRequests + requests); integer(current.totals.grantedInputBytes + inputBytes);
    this.ledger.grant(requests, inputBytes, current.policy!, false);
  }
}
