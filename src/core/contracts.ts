import type { Usage } from "@earendil-works/pi-ai";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export type Question =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "bool"; instructions: string; criteria: { true: string; false: string } }
  | { type: "score"; instructions: string; criteria: string[] };
export type Answer =
  | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: "bool"; probability: number }
  | { type: "score"; score: number; confidence: number };
export interface Run { maxRequests?: number; maxInputBytes?: number; maxWorkMs?: number }
export interface Item { id: string; inputVersion: string; state: JsonObject }
export interface Submit {
  items: Item[];
  rubricVersion: string;
  questions: Record<string, Question>;
  abstainChoices?: Record<string, string[]>;
  run?: Run;
}
export interface Results { batchId: string; cursor?: string; limit?: number }
export interface Continue { batchId: string; expectedIdentity: string; retryFailedIds?: string[]; run: Run }
export interface ModelKey { provider: string; id: string }
export interface ModelIdentity extends ModelKey {
  api: string;
  configurationFingerprint: string;
  backendVersionKnown: false;
}
export interface Limits {
  requests: number;
  inputBytes: number;
  concurrency: number;
  maxWorkMs: number;
  maxAttemptMs: number;
  maxRetries: number;
}
export interface Configuration {
  version: 1;
  defaultModel?: ModelKey;
  fileExclusions?: string[];
  families: { generic: boolean; semantic: boolean };
  limits: Limits;
}
export type Consumer = "generic" | "semantic" | "library";
export type Outcome =
  | { id: string; inputVersion: string; status: "pending" | "running"; attempts: number }
  | { id: string; inputVersion: string; status: "completed"; attempts: number;
      answers: Record<string, Answer>; abstainedQuestionIds: string[];
      origin: "provider" | "reuse"; judgmentId: string }
  | { id: string; inputVersion: string; status: "failed"; attempts: number;
      error: { code: string; retryEligible: boolean } };
export type StopReason = "prepared" | "complete" | "call_limit" | "budget_exhausted" |
  "deadline" | "cancelled" | "disabled" | "model_policy_mismatch" | "storage_error" |
  "persistence_required" | "model_unavailable";
export interface LedgerTotals {
  grantedRequests: number; chargedRequests: number; remainingRequests: number;
  grantedInputBytes: number; chargedInputBytes: number; remainingInputBytes: number;
  unknownAttempts: number;
}
export interface UsageGroup { provider: string; model: string; usage: Usage | null; pricing: "known" | "unknown" }
export interface BatchPage {
  batchId: string; identity: string; model: ModelIdentity; rubricVersion: string;
  state: "prepared" | "running" | "partial" | "complete";
  counts: { total: number; completed: number; failed: number; pending: number; running: number };
  stopReason: StopReason;
  items: Outcome[];
  page: { nextCursor: string | null; truncated: boolean };
  diagnostics: { attempts: number; cacheHits: number; elapsedMs: number; unknownUsageAttempts: number };
  usage: UsageGroup[];
  ledger: LedgerTotals;
}
export type Envelope = { ok: true; value: BatchPage } |
  { ok: false; error: { code: string; message: string }; batch?: BatchPage };
export interface ExecutionResult { data: Envelope; usageDelta?: Usage }
export interface CallOptions { signal?: AbortSignal }
export interface Client {
  readonly protocol: 1;
  submit(input: Submit, options?: CallOptions): Promise<ExecutionResult>;
  results(input: Results): ExecutionResult;
  continue(input: Continue, options?: CallOptions): Promise<ExecutionResult>;
}
export type { Usage };
