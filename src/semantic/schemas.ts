import { Type, type Static } from "typebox";
import { batchPageSchema, runSchema } from "../pi/schemas.js";

const closed = { additionalProperties: false } as const;
const id = Type.String({ minLength: 1, maxLength: 128 });
const hash = Type.String({ pattern: "^[a-f0-9]{64}$" });
const count = Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER });
const positive = Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER });
const probability = Type.Number({ minimum: 0, maximum: 1 });
const targetMatches = Type.Integer({ minimum: 1, maximum: 100 });
const discoveryView = Type.Union([Type.Literal("new_matches"), Type.Literal("matches"), Type.Literal("all")]);
const cursor = Type.String({ minLength: 1, maxLength: 512 });
export const policySchema = Type.Object({ version: Type.Literal(1), minMatchProbability: probability }, closed);
export const provenanceSchema = Type.Object({
  label: Type.Optional(Type.String({ maxLength: 512 })), path: Type.Optional(Type.String({ maxLength: 512 })),
  startLine: Type.Optional(positive), endLine: Type.Optional(positive),
}, closed);
export const recordSchema = Type.Object({ id, text: Type.String({ maxLength: 16_384 }),
  provenance: Type.Optional(provenanceSchema) }, closed);
export const filterSchema = Type.Object({ records: Type.Array(recordSchema, { minItems: 1, maxItems: 128 }),
  predicate: Type.String({ minLength: 1, maxLength: 2048 }), policy: Type.Optional(policySchema),
  run: Type.Optional(runSchema) }, closed);
export const searchSchema = Type.Object({ predicate: Type.String({ minLength: 1, maxLength: 2048 }),
  scope: Type.Optional(Type.Object({ paths: Type.Optional(Type.Array(Type.String({ minLength: 1, maxLength: 4096 }),
    { minItems: 1, maxItems: 256, uniqueItems: true })) }, closed)),
  mode: Type.Optional(Type.Union([Type.Literal("systematic"), Type.Literal("discovery")])), targetMatches: Type.Optional(targetMatches),
  policy: Type.Optional(policySchema), run: Type.Optional(runSchema) }, closed);
export const semanticResultsSchema = Type.Object({ operationId: id, cursor: Type.Optional(cursor),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })), policy: Type.Optional(policySchema), view: Type.Optional(discoveryView) }, closed);
export const semanticContinueSchema = Type.Object({ operationId: id, expectedIdentity: hash, run: runSchema, targetMatches: Type.Optional(targetMatches),
  retryFailedEvidenceIds: Type.Optional(Type.Array(id, { maxItems: 128, uniqueItems: true })) }, closed);
export const evidenceInputSchema = Type.Object({ operationId: id,
  evidenceIds: Type.Array(id, { minItems: 1, maxItems: 20, uniqueItems: true }), startOffsetLines: Type.Optional(count),
  maxLines: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  maxBytes: Type.Optional(Type.Integer({ minimum: 1, maximum: 16_384 })), checkCurrent: Type.Optional(Type.Boolean()) }, closed);

export const recordEvidenceSchema = Type.Object({ evidenceId: id, preparationVersion: Type.Literal("windows-v1"),
  textHash: hash, inputVersion: hash, kind: Type.Literal("record"), recordId: id,
  verification: Type.Literal("unverified"), provenance: Type.Union([provenanceSchema, Type.Null()]) }, closed);
export const recordSnippetSchema = Type.Object({ evidenceId: id, path: Type.Null(), startLine: Type.Null(), endLine: Type.Null(),
  text: Type.String({ maxLength: 16_384 }), textHash: hash, format: Type.Literal("plain"), truncated: Type.Boolean(),
  nextOffsetLines: Type.Union([count, Type.Null()]), freshness: Type.Literal("unverified") }, closed);
export const fileEvidenceSchema = Type.Object({ evidenceId: id, preparationVersion: Type.Literal("windows-v1"),
  textHash: hash, inputVersion: hash, kind: Type.Literal("file"), verification: Type.Literal("captured"),
  rootId: id, snapshotId: hash, path: Type.String({ minLength: 1, maxLength: 4096 }), startLine: positive, endLine: positive, fileHash: hash }, closed);
export const fileSnippetSchema = Type.Object({ ...recordSnippetSchema.properties, path: Type.String({ minLength: 1, maxLength: 4096 }),
  startLine: Type.Union([positive, Type.Null()]), endLine: Type.Union([positive, Type.Null()]),
  freshness: Type.Union([Type.Literal("captured"), Type.Literal("unchanged"), Type.Literal("changed"), Type.Literal("missing"), Type.Literal("unverifiable")]) }, closed);
const snippetSchema = Type.Union([recordSnippetSchema, fileSnippetSchema]);
export const relevanceAnswerSchema = Type.Object({ type: Type.Literal("choice"),
  choice: Type.Union([Type.Literal("match"), Type.Literal("no_match"), Type.Literal("insufficient_context")]),
  probabilities: Type.Object({ match: probability, no_match: probability, insufficient_context: probability }, closed),
  confidence: probability }, closed);
export const rawJudgmentSchema = Type.Object({ judgmentId: id,
  origin: Type.Union([Type.Literal("provider"), Type.Literal("reuse")]), answer: relevanceAnswerSchema,
  model: batchPageSchema.properties.model, rubricVersion: Type.Literal("semantic-v1") }, closed);
const expansion = Type.Object({ state: Type.Literal("none"), evidence: Type.Null(), attempts: Type.Literal(0), error: Type.Null() }, closed);
const base = { evidence: recordEvidenceSchema, snippet: recordSnippetSchema, attempts: count, expansion };
export const recordItemSchema = Type.Union([
  Type.Object({ ...base, status: Type.Union([Type.Literal("pending"), Type.Literal("running")]) }, closed),
  Type.Object({ ...base, status: Type.Literal("failed"), error: Type.Object({ code: id, retryEligible: Type.Boolean() }, closed) }, closed),
  Type.Object({ ...base, status: Type.Literal("judged"), raw: rawJudgmentSchema, expanded: Type.Null(),
    outcome: Type.Union([Type.Literal("match"), Type.Literal("no_match"), Type.Literal("unresolved")]),
    reason: Type.Union([Type.Null(), Type.Literal("below_cutoff"), Type.Literal("insufficient_context")]) }, closed),
]);
export const recordPageSchema = Type.Object({ operationId: id, kind: Type.Literal("filter"), identity: hash,
  revision: count, viewIdentity: hash, model: batchPageSchema.properties.model, rubricVersion: Type.Literal("semantic-v1"),
  preparationVersion: Type.Literal("windows-v1"), policy: policySchema, policyIdentity: hash, mode: Type.Literal("filter"),
  targetMatches: Type.Null(), stopPolicy: Type.Null(),
  state: Type.Union([Type.Literal("prepared"), Type.Literal("partial"), Type.Literal("complete")]),
  stopReason: Type.Union([Type.Literal("prepared"), Type.Literal("complete"), Type.Literal("call_limit"),
    Type.Literal("budget_exhausted"), Type.Literal("deadline"), Type.Literal("cancelled"), Type.Literal("disabled"),
    Type.Literal("model_policy_mismatch"), Type.Literal("storage_error"), Type.Literal("persistence_required"),
    Type.Literal("model_unavailable"), Type.Literal("workspace_full")]),
  items: Type.Array(recordItemSchema, { maxItems: 100 }),
  coverage: Type.Object({
    enumeration: Type.Object({ complete: Type.Literal(true), candidatesSeen: count, remainingCandidates: Type.Literal(0) }, closed),
    files: Type.Object({ captured: Type.Literal(0), excluded: Type.Literal(0) }, closed),
    initial: Type.Object({ total: count, judged: count, failed: count, pending: count, running: count }, closed),
    expanded: Type.Object({ pending: Type.Literal(0), running: Type.Literal(0), complete: Type.Literal(0), failed: Type.Literal(0), unavailable: Type.Literal(0) }, closed),
    excludedRanges: Type.Literal(0), exclusions: Type.Array(Type.Never(), { maxItems: 0 }),
    exclusionCounts: Type.Array(Type.Never(), { maxItems: 0 }), exclusionsTruncated: Type.Literal(false),
  }, closed),
  outcomeCounts: Type.Object({ match: count, noMatch: count, unresolved: count }, closed), complete: Type.Boolean(),
  continuation: Type.Object({ canResume: Type.Boolean(), reason: Type.Union([id, Type.Null()]) }, closed),
  page: Type.Object({ nextCursor: Type.Union([cursor, Type.Null()]), truncated: Type.Boolean() }, closed),
  diagnostics: batchPageSchema.properties.diagnostics, usage: batchPageSchema.properties.usage, ledger: batchPageSchema.properties.ledger,
}, closed);
export const fileItemSchema = Type.Union([
  Type.Object({ ...recordItemSchema.anyOf[0].properties, evidence: fileEvidenceSchema, snippet: fileSnippetSchema }, closed),
  Type.Object({ ...recordItemSchema.anyOf[1].properties, evidence: fileEvidenceSchema, snippet: fileSnippetSchema }, closed),
  Type.Object({ ...recordItemSchema.anyOf[2].properties, evidence: fileEvidenceSchema, snippet: fileSnippetSchema }, closed),
]);
const exclusionReason = Type.Union([Type.Literal("outside_root"), Type.Literal("link"), Type.Literal("nonregular"),
  Type.Literal("nested_repository"), Type.Literal("sensitive"), Type.Literal("dependency_generated"), Type.Literal("user_excluded"),
  Type.Literal("missing"), Type.Literal("unreadable"), Type.Literal("changed"), Type.Literal("unverifiable"),
  Type.Literal("file_too_large"), Type.Literal("binary_or_encoding"), Type.Literal("empty"), Type.Literal("line_too_large")]);
export const searchPageSchema = Type.Object({ ...recordPageSchema.properties, kind: Type.Literal("search"), mode: Type.Literal("systematic"),
  stopReason: Type.Union([...recordPageSchema.properties.stopReason.anyOf, Type.Literal("scope_limit")]),
  items: Type.Array(fileItemSchema, { maxItems: 100 }),
  coverage: Type.Object({ ...recordPageSchema.properties.coverage.properties,
    enumeration: Type.Object({ complete: Type.Boolean(), candidatesSeen: count, remainingCandidates: Type.Union([count, Type.Null()]) }, closed),
    files: Type.Object({ captured: count, excluded: count }, closed), excludedRanges: count,
    exclusions: Type.Array(Type.Object({ path: Type.String({ maxLength: 4096 }), startLine: Type.Union([positive, Type.Null()]),
      endLine: Type.Union([positive, Type.Null()]), reason: exclusionReason }, closed), { maxItems: 100 }),
    exclusionCounts: Type.Array(Type.Object({ reason: exclusionReason, count }, closed), { maxItems: 15 }), exclusionsTruncated: Type.Boolean(),
  }, closed),
}, closed);
export const discoveryPageSchema = Type.Object({ ...searchPageSchema.properties, mode: Type.Literal("discovery"),
  targetMatches, stopPolicy: policySchema, view: discoveryView,
  yieldProgress: Type.Object({ matched: count }, closed),
  stopReason: Type.Union([...searchPageSchema.properties.stopReason.anyOf, Type.Literal("target_reached")]),
}, closed);
export const semanticPageSchema = Type.Union([recordPageSchema, searchPageSchema, discoveryPageSchema]);
const error = Type.Object({ code: id, message: Type.String({ maxLength: 256 }) }, closed);
export const semanticEnvelopeSchema = Type.Union([
  Type.Object({ ok: Type.Literal(true), value: semanticPageSchema }, closed),
  Type.Object({ ok: Type.Literal(false), error, partial: Type.Optional(semanticPageSchema) }, closed),
]);
export const evidencePageSchema = Type.Object({ operationId: id, revision: count,
  snippets: Type.Array(snippetSchema, { maxItems: 20 }), truncated: Type.Boolean() }, closed);
export const evidenceEnvelopeSchema = Type.Union([
  Type.Object({ ok: Type.Literal(true), value: evidencePageSchema }, closed), Type.Object({ ok: Type.Literal(false), error }, closed),
]);
export type Policy = Static<typeof policySchema>;
export type RecordInput = Static<typeof recordSchema>;
export type FilterInput = Static<typeof filterSchema>;
export type SearchInput = Static<typeof searchSchema>;
export type ResultsInput = Static<typeof semanticResultsSchema>;
export type ContinueInput = Static<typeof semanticContinueSchema>;
export type EvidenceInput = Static<typeof evidenceInputSchema>;
export type RecordEvidence = Static<typeof recordEvidenceSchema>;
export type Snippet = Static<typeof snippetSchema>;
export type RawJudgment = Static<typeof rawJudgmentSchema>;
export type RelevanceAnswer = Static<typeof relevanceAnswerSchema>;
export type ItemResult = Static<typeof recordItemSchema> | Static<typeof fileItemSchema>;
export type SemanticPage = Static<typeof semanticPageSchema>;
export type SemanticEnvelope = Static<typeof semanticEnvelopeSchema>;
export type EvidencePage = Static<typeof evidencePageSchema>;
export type EvidenceEnvelope = Static<typeof evidenceEnvelopeSchema>;
