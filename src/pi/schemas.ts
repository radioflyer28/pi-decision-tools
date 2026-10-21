import { Type } from "typebox";

const closed = { additionalProperties: false } as const;
const id = Type.String({ minLength: 1, maxLength: 128 });
const text = Type.String({ minLength: 1 });
const count = Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER });
const probability = Type.Number({ minimum: 0, maximum: 1 });
const strings = Type.Record(id, text, { minProperties: 2, maxProperties: 32 });
const questions = Type.Record(id, Type.Union([
  Type.Object({ type: Type.Literal("choice"), instructions: text, criteria: strings }, closed),
  Type.Object({ type: Type.Literal("bool"), instructions: text,
    criteria: Type.Object({ true: text, false: text }, closed) }, closed),
  Type.Object({ type: Type.Literal("score"), instructions: text,
    criteria: Type.Array(text, { minItems: 2, maxItems: 32 }) }, closed),
]), { minProperties: 1, maxProperties: 16 });
export const runSchema = Type.Object({
  maxRequests: Type.Optional(count), maxInputBytes: Type.Optional(count),
  maxWorkMs: Type.Optional(Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER })),
}, closed);
export const submitSchema = Type.Object({
  items: Type.Array(Type.Object({ id, inputVersion: id,
    state: Type.Record(Type.String(), Type.Unknown()) }, closed), { minItems: 1, maxItems: 128 }),
  rubricVersion: id, questions,
  abstainChoices: Type.Optional(Type.Record(id, Type.Array(id, { uniqueItems: true }))),
  run: Type.Optional(runSchema),
}, closed);
export const resultsSchema = Type.Object({ batchId: id, cursor: Type.Optional(id),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })) }, closed);
export const continueSchema = Type.Object({ batchId: id, expectedIdentity: id,
  retryFailedIds: Type.Optional(Type.Array(id, { maxItems: 128, uniqueItems: true })), run: runSchema }, closed);

const answer = Type.Union([
  Type.Object({ type: Type.Literal("choice"), choice: id,
    probabilities: Type.Record(id, probability), confidence: probability }, closed),
  Type.Object({ type: Type.Literal("bool"), probability }, closed),
  Type.Object({ type: Type.Literal("score"), score: Type.Number({ minimum: 0, maximum: 31 }), confidence: probability }, closed),
]);
const itemBase = { id, inputVersion: id, attempts: count };
const outcome = Type.Union([
  Type.Object({ ...itemBase, status: Type.Union([Type.Literal("pending"), Type.Literal("running")]) }, closed),
  Type.Object({ ...itemBase, status: Type.Literal("completed"), answers: Type.Record(id, answer),
    abstainedQuestionIds: Type.Array(id), origin: Type.Union([Type.Literal("provider"), Type.Literal("reuse")]), judgmentId: id }, closed),
  Type.Object({ ...itemBase, status: Type.Literal("failed"),
    error: Type.Object({ code: text, retryEligible: Type.Boolean() }, closed) }, closed),
]);
const nonnegative = Type.Number({ minimum: 0 });
const usage = Type.Object({ input: nonnegative, output: nonnegative, cacheRead: nonnegative,
  cacheWrite: nonnegative, cacheWrite1h: Type.Optional(nonnegative), reasoning: Type.Optional(nonnegative),
  totalTokens: nonnegative,
  cost: Type.Object({ input: nonnegative, output: nonnegative, cacheRead: nonnegative,
    cacheWrite: nonnegative, total: nonnegative }, closed) }, closed);
export const batchPageSchema = Type.Object({
  batchId: id, identity: id, rubricVersion: id,
  model: Type.Object({ provider: text, id: text, api: text, configurationFingerprint: id,
    backendVersionKnown: Type.Literal(false) }, closed),
  state: Type.Union([Type.Literal("prepared"),Type.Literal("running"),Type.Literal("partial"),Type.Literal("complete")]),
  counts: Type.Object({ total: count, completed: count, failed: count, pending: count, running: count }, closed),
  stopReason: Type.Union(["prepared", "complete", "call_limit", "budget_exhausted", "deadline", "cancelled",
    "disabled", "model_policy_mismatch", "storage_error", "persistence_required", "model_unavailable"].map(x => Type.Literal(x))),
  items: Type.Array(outcome, { maxItems: 100 }),
  page: Type.Object({ nextCursor: Type.Union([id, Type.Null()]), truncated: Type.Boolean() }, closed),
  diagnostics: Type.Object({ attempts: count, cacheHits: count, elapsedMs: nonnegative, unknownUsageAttempts: count }, closed),
  usage: Type.Array(Type.Object({ provider: text, model: text, usage: Type.Union([usage, Type.Null()]),
    pricing: Type.Union([Type.Literal("known"),Type.Literal("unknown")]) }, closed)),
  ledger: Type.Object({ grantedRequests: count, chargedRequests: count, remainingRequests: count,
    grantedInputBytes: count, chargedInputBytes: count, remainingInputBytes: count, unknownAttempts: count }, closed),
}, closed);
export const envelopeSchema = Type.Union([
  Type.Object({ ok: Type.Literal(true), value: batchPageSchema }, closed),
  Type.Object({ ok: Type.Literal(false), error: Type.Object({ code: text, message: text }, closed),
    batch: Type.Optional(batchPageSchema) }, closed),
]);
