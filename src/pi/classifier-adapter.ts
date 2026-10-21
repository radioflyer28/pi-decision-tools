import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
import type { ClassifierApi, ClassifierModel } from "@earendil-works/pi-ai";
import type { Answer, JsonObject, ModelIdentity, Question, Usage } from "../core/contracts.js";
import { pinModel, type AvailableModel } from "../core/controls.js";
import { requireThat } from "../core/errors.js";
import { identity, parseAnswers } from "../core/validation.js";
import { parseUsage } from "../core/ledger.js";

type Registry = Pick<ModelRegistry, "getAvailableOfType" | "classify">;
export type NativeModel = ClassifierModel<ClassifierApi>;
export interface NativeOutcome {
  outcome: "answered" | "failed" | "aborted";
  answers?: Record<string, Answer>;
  code?: string;
  retryEligible: boolean;
  automaticRetry: boolean;
  usage: Usage | null;
  pricing: "known" | "unknown";
  provider: string;
  model: string;
}
/** All authentication/transport remains in Pi's registry; no provider SDKs here. */
export class ClassifierAdapter {
  #models: readonly NativeModel[] = [];
  #refresh: Promise<void> | undefined;
  constructor(private readonly registry: Registry) {}
  available = (): readonly AvailableModel[] => this.#models.map(({ provider, id, api, baseUrl }) => ({ provider, id, api, baseUrl }));
  refresh(): Promise<void> {
    if (this.#refresh) return this.#refresh;
    // Publish atomically: concurrent preflight must not see a transient empty list.
    // Resolve still awaits fresh discovery before every dispatch. Coalescing also
    // prevents an older refresh from overwriting a newer failure/snapshot.
    this.#refresh = (async () => {
      try { this.#models = structuredClone(await this.registry.getAvailableOfType("classifier")); }
      catch (error) { this.#models = []; throw error; }
    })().finally(() => { this.#refresh = undefined; });
    return this.#refresh;
  }
  async resolve(pinned: ModelIdentity): Promise<NativeModel> {
    await this.refresh();
    const model = this.#models.find(m => m.provider === pinned.provider && m.id === pinned.id);
    requireThat(model, "model_unavailable");
    requireThat(identity(pinModel(model)) === identity(pinned), "model_policy_mismatch");
    return structuredClone(model);
  }
  async invoke(model: NativeModel, state: JsonObject, questions: Record<string, Question>,
    signal: AbortSignal, timeoutMs: number): Promise<NativeOutcome> {
    let status: number | undefined;
    let forbidden = false;
    const pricing = Object.values(model.cost).some(value => typeof value === "number" && Number.isFinite(value) && value > 0) ? "known" : "unknown";
    const base: NativeOutcome = { outcome: "failed", code: "provider_error", retryEligible: false,
      automaticRetry: false, usage: null, pricing, provider: model.provider, model: model.id };
    try {
      const result = await this.registry.classify(model, structuredClone({ state, questions }), {
        signal, timeoutMs, maxRetries: 0,
        onResponse(response) {
          status = response.status;
          if (status === 401 || status === 403) forbidden = true;
        },
      });
      if (result.usage !== undefined) {
        try { base.usage = parseUsage(result.usage); }
        catch { return { ...base, code: "invalid_response" }; }
      }
      if (result.provider !== model.provider || result.model !== model.id || result.api !== model.api)
        // Unverified response identity may contain arbitrary evidence/error text.
        // Do not echo it or falsely attribute its reported usage to the pinned model.
        return { ...base, provider: "unknown", model: "unknown", code: "model_identity_mismatch" };
      if (result.stopReason === "aborted")
        return { ...base, outcome: "aborted", code: "cancelled", retryEligible: true };
      if (result.stopReason === "stop") {
        try {
          const { code: _code, ...answered } = base;
          return { ...answered, outcome: "answered", answers: parseAnswers(result.answers, questions) };
        }
        catch { return { ...base, code: "invalid_response" }; }
      }
      if (result.stopReason !== "error") return { ...base, code: "invalid_response" };
    } catch {
      if (signal.aborted) return { ...base, outcome: "aborted", code: "cancelled", retryEligible: true };
    }
    const retry = !forbidden && status !== undefined && [408, 429, 500, 502, 503, 504].includes(status);
    return { ...base, retryEligible: retry, automaticRetry: retry };
  }
}
