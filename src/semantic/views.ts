import type { ModelIdentity, Outcome } from "../core/contracts.js";
import { requireThat } from "../core/errors.js";
import { parseAnswers } from "../core/validation.js";
import { QUESTIONS, textHash, type PreparedRecord, type PreparedFile } from "./preparation.js";
import { parseEvidence, parsePolicy, SEMANTIC_BOUNDS } from "./validation.js";
import type { EvidenceInput, ItemResult, Policy, RelevanceAnswer, Snippet } from "./schemas.js";

type SnippetOptions = Pick<EvidenceInput, "startOffsetLines" | "maxLines" | "maxBytes" | "checkCurrent">;
/** Captured record bytes only. Even checkCurrent cannot access or upgrade caller provenance. */
export function recordSnippet(record: PreparedRecord, options: SnippetOptions = {}): Snippet {
  const input = parseEvidence({ ...options, operationId: "snippet", evidenceIds: [record.evidence.evidenceId] });
  const offset = input.startOffsetLines ?? 0, maxLines = input.maxLines ?? SEMANTIC_BOUNDS.defaultLines;
  const maxBytes = input.maxBytes ?? SEMANTIC_BOUNDS.defaultSnippetBytes;
  const text = record.text;
  const lineEnd = (start: number) => { const lf = text.indexOf("\n", start); return lf < 0 ? text.length : lf + 1; };
  let start = 0, skipped = 0;
  while (start < text.length && skipped < offset) { start = lineEnd(start); skipped++; }
  let end = start, lines = 0, bytes = 0;
  while (end < text.length && lines < maxLines) {
    const next = lineEnd(end), size = Buffer.byteLength(text.slice(end, next));
    if (size > maxBytes - bytes) {
      requireThat(lines > 0 || maxBytes < SEMANTIC_BOUNDS.snippetBytes, "output_limit");
      break;
    }
    bytes += size; end = next; lines++;
  }
  const span = text.slice(start, end), truncated = end < text.length;
  return { evidenceId: record.evidence.evidenceId, path: null, startLine: null, endLine: null,
    text: start === 0 ? span.replace(/^\uFEFF/, "") : span, textHash: textHash(span), format: "plain",
    truncated, nextOffsetLines: truncated ? skipped + lines : null, freshness: "unverified" };
}
export function deriveOutcome(answer: RelevanceAnswer, policy: Policy): { outcome: "match" | "no_match" | "unresolved";
  reason: null | "below_cutoff" | "insufficient_context" } {
  const selected = parsePolicy(policy);
  if (answer.choice === "no_match") return { outcome: "no_match", reason: null };
  if (answer.choice === "insufficient_context") return { outcome: "unresolved", reason: "insufficient_context" };
  return answer.probabilities.match >= selected.minMatchProbability ? { outcome: "match", reason: null } :
    { outcome: "unresolved", reason: "below_cutoff" };
}
export function qualifies(outcome: Outcome, policy: Policy): boolean {
  return outcome.status === "completed" && deriveOutcome(outcome.answers.relevance as RelevanceAnswer, policy).outcome === "match";
}
/** Core outcomes are validated by the coordinator; raw answers are revalidated at this internal seam. */
export function itemView(record: PreparedRecord | PreparedFile, outcome: Outcome, model: ModelIdentity, policy: Policy, snippet?: Snippet): ItemResult {
  parsePolicy(policy);
  const base = { evidence: structuredClone(record.evidence), snippet: snippet ?? recordSnippet(record as PreparedRecord), attempts: outcome.attempts,
    expansion: { state: "none" as const, evidence: null, attempts: 0 as const, error: null } };
  if (outcome.status === "failed") return { ...base, status: "failed", error: { ...outcome.error } } as ItemResult;
  if (outcome.status !== "completed") return { ...base, status: outcome.status } as ItemResult;
  const answer = parseAnswers(outcome.answers, QUESTIONS).relevance as RelevanceAnswer;
  return { ...base, status: "judged", raw: { judgmentId: outcome.judgmentId, origin: outcome.origin, answer,
    model: structuredClone(model), rubricVersion: "semantic-v1" }, expanded: null, ...deriveOutcome(answer, policy) } as ItemResult;
}
