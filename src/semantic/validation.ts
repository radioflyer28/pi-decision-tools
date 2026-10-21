import { PATH_JSON_BYTES } from "../core/relative-path.js";
import { parseScope } from "../filesystem/policy.js";
import { searchSchema, type SearchInput } from "./schemas.js";
import { Check } from "typebox/value";
import type { TSchema } from "typebox";
import { requireThat } from "../core/errors.js";
import { copyJson, identifier, parseRun } from "../core/validation.js";
import { filterSchema, policySchema, semanticResultsSchema, semanticContinueSchema, evidenceInputSchema,
  type FilterInput, type Policy, type ResultsInput, type ContinueInput, type EvidenceInput } from "./schemas.js";

export const SEMANTIC_BOUNDS = Object.freeze({ records: 128, textBytes: 16_384, predicateBytes: 2048,
  provenanceBytes: 512, cursorBytes: 512, submissionBytes: 1_048_576, parents: 8, childItems: 8,
  defaultItems: 20, pageItems: 100, pageBytes: 131_072, evidenceIds: 20, defaultLines: 20,
  defaultSnippetBytes: 2048, snippetLines: 100, snippetBytes: 16_384 });
export const DEFAULT_POLICY: Readonly<Policy> = Object.freeze({ version: 1, minMatchProbability: 0 });

/** Copy before schema inspection; rejects getters, malformed Unicode and oversized JSON without allocation of work. */
function validated<T>(schema: TSchema, value: unknown): T {
  const copy = copyJson(value, SEMANTIC_BOUNDS.submissionBytes);
  requireThat(Check(schema, copy));
  return copy as T;
}
function bytes(value: string, maximum: number): void { requireThat(Buffer.byteLength(value, "utf8") <= maximum); }
function ids(values: string[]): void { values.forEach(identifier); requireThat(new Set(values).size === values.length); }
export function parsePolicy(value: unknown): Policy { return validated<Policy>(policySchema, value); }
export function parseFilter(value: unknown): FilterInput {
  const input = validated<FilterInput>(filterSchema, value);
  bytes(input.predicate, SEMANTIC_BOUNDS.predicateBytes);
  ids(input.records.map(record => record.id));
  for (const record of input.records) {
    bytes(record.text, SEMANTIC_BOUNDS.textBytes);
    const p = record.provenance;
    if (p) {
      if (p.label !== undefined) bytes(p.label, SEMANTIC_BOUNDS.provenanceBytes);
      if (p.path !== undefined) bytes(p.path, SEMANTIC_BOUNDS.provenanceBytes);
      requireThat((p.startLine === undefined) === (p.endLine === undefined));
      if (p.startLine !== undefined) requireThat(p.endLine! >= p.startLine);
    }
  }
  if (input.run !== undefined) parseRun(input.run);
  return input;
}
export function parseSearch(value: unknown): SearchInput {
  const input = copyJson(value, PATH_JSON_BYTES) as unknown as SearchInput;
  requireThat(Check(searchSchema, input));
  requireThat(input.targetMatches === undefined || input.mode === "discovery");
  bytes(input.predicate, SEMANTIC_BOUNDS.predicateBytes);
  if (input.scope !== undefined) input.scope = parseScope(input.scope);
  if (input.run !== undefined) parseRun(input.run);
  return input;
}
export function parseSemanticResults(value: unknown): ResultsInput {
  const input = validated<ResultsInput>(semanticResultsSchema, value);
  identifier(input.operationId);
  if (input.cursor !== undefined) bytes(input.cursor, SEMANTIC_BOUNDS.cursorBytes);
  return input;
}
export function parseSemanticContinue(value: unknown): ContinueInput {
  const input = validated<ContinueInput>(semanticContinueSchema, value);
  identifier(input.operationId); parseRun(input.run);
  if (input.retryFailedEvidenceIds !== undefined) ids(input.retryFailedEvidenceIds);
  return input;
}
export function parseEvidence(value: unknown): EvidenceInput {
  const input = validated<EvidenceInput>(evidenceInputSchema, value);
  identifier(input.operationId); ids(input.evidenceIds);
  return input;
}
