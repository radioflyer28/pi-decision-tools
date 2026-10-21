import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { errorCode, requireThat, ToolkitError } from "../core/errors.js";
import { exact, integer, jsonBytes } from "../core/validation.js";
import { isSearch, policyIdentity, viewIdentity } from "./preparation.js";
import { deriveOutcome, itemView, qualifies } from "./views.js";
import { parseEvidence, parseSemanticResults, SEMANTIC_BOUNDS } from "./validation.js";
import type { SemanticParents, Parent } from "./parents.js";
import type { EvidenceEnvelope, ItemResult, Snippet, Policy, RelevanceAnswer, SemanticEnvelope, SemanticPage } from "./schemas.js";

/** Stateless cursors authenticate parent, runtime secret, revision, view, limit and offset. */
export class SemanticResults {
  #secret = randomBytes(32);
  constructor(readonly parents: SemanticParents) {}
  #mac(id: string, payload: string): string { return createHmac("sha256", this.#secret).update(`${id}:${payload}`).digest("base64url"); }
  #cursor(parent: Parent, view: string, limit: number, offset: number): string {
    const payload = Buffer.from(JSON.stringify({ r: parent.revision, v: view, l: limit, o: offset })).toString("base64url");
    return `${payload}.${this.#mac(parent.id, payload)}`;
  }
  #offset(parent: Parent, view: string, limit: number, cursor?: string): number {
    if (!cursor) return 0;
    try {
      const [payload, signature, extra] = cursor.split(".");
      requireThat(payload && signature && extra === undefined && /^[A-Za-z0-9_-]+$/.test(payload), "cursor_invalid");
      const expected = Buffer.from(this.#mac(parent.id, payload)), supplied = Buffer.from(signature);
      requireThat(expected.length === supplied.length && timingSafeEqual(expected, supplied), "cursor_invalid");
      const decoded = exact(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")), ["r", "v", "l", "o"]);
      integer(decoded.r); integer(decoded.l, 1, 100); integer(decoded.o, 0, parent.outcomes.length);
      requireThat(decoded.r === parent.revision, "cursor_stale");
      requireThat(decoded.v === view && decoded.l === limit, "cursor_invalid");
      return decoded.o as number;
    } catch (error) { throw new ToolkitError(errorCode(error) === "cursor_stale" ? "cursor_stale" : "cursor_invalid"); }
  }
  #base(parent: Parent, policy: Policy, view?: "new_matches" | "matches" | "all"): SemanticPage {
    const initial = { total: parent.outcomes.length, judged: 0, failed: 0, pending: 0, running: 0 };
    const outcomeCounts = { match: 0, noMatch: 0, unresolved: 0 };
    let retry = false;
    for (const outcome of parent.outcomes) {
      if (outcome.status === "completed") {
        initial.judged++;
        const derived = deriveOutcome(outcome.answers.relevance as RelevanceAnswer, policy).outcome;
        outcomeCounts[derived === "no_match" ? "noMatch" : derived]++;
      } else {
        initial[outcome.status]++;
        if (outcome.status === "failed" && outcome.error.retryEligible) retry = true;
      }
    }
    const summary = isSearch(parent.prepared) ? parent.prepared.summary : undefined;
    const complete = initial.pending + initial.running === 0 && (summary?.scopeComplete ?? true), canResume = initial.pending > 0 || retry;
    const stopReason = summary && !summary.scopeComplete && (parent.stopReason === "prepared" || parent.stopReason === "complete")
      ? summary.stopReason : parent.stopReason;
    return { operationId: parent.id, kind: summary ? "search" : "filter", identity: parent.prepared.identity, revision: parent.revision,
      viewIdentity: viewIdentity(parent.prepared.identity, parent.revision, policy, view), model: parent.prepared.model,
      rubricVersion: "semantic-v1", preparationVersion: "windows-v1", policy, policyIdentity: policyIdentity(policy),
      mode: summary ? "systematic" : "filter", targetMatches: null, stopPolicy: null,
      ...(parent.discovery ? { mode: "discovery", targetMatches: parent.discovery.targetMatches,
        stopPolicy: parent.prepared.policy, view,
        yieldProgress: { matched: parent.outcomes.filter(o => parent.discovery!.latestJudgedIds.includes(o.id) && qualifies(o, parent.prepared.policy)).length } } : {}),
      state: complete ? "complete" : stopReason === "prepared" ? "prepared" : "partial", stopReason,
      items: [], coverage: { enumeration: summary?.enumeration ?? { complete: true, candidatesSeen: initial.total, remainingCandidates: 0 },
        files: summary?.files ?? { captured: 0, excluded: 0 }, initial, expanded: { pending: 0, running: 0, complete: 0, failed: 0, unavailable: 0 },
        excludedRanges: summary?.excludedRanges ?? 0, exclusions: summary?.exclusions ?? [], exclusionCounts: summary?.exclusionCounts ?? [], exclusionsTruncated: summary?.exclusionsTruncated ?? false },
      outcomeCounts, complete, continuation: { canResume, reason: canResume ? (stopReason === "complete" ? "retry_required" : stopReason) : summary && !summary.scopeComplete ? summary.stopReason : null },
      page: { nextCursor: null, truncated: false }, diagnostics: parent.diagnostics, usage: parent.usage,
      ledger: this.parents.core.controls.ledger.snapshot().totals } as SemanticPage;
  }
  page(raw: unknown, failure?: string): SemanticEnvelope {
    try {
      const input = parseSemanticResults(raw), parent = this.parents.get(input.operationId);
      requireThat(!parent.busy, "search_busy");
      const policy = input.policy ?? parent.prepared.policy, limit = input.limit ?? SEMANTIC_BOUNDS.defaultItems;
      requireThat(input.view === undefined || parent.discovery !== undefined);
      const view = parent.discovery ? input.view ?? "new_matches" : undefined;
      const latest = new Set(parent.discovery?.latestJudgedIds ?? []);
      const indices = parent.outcomes.map((_, i) => i).filter(i => !view || view === "all" ||
        (qualifies(parent.outcomes[i]!, policy) && (view === "matches" || latest.has(parent.outcomes[i]!.id))));
      const page = this.#base(parent, policy, view), offset = this.#offset(parent, page.viewIdentity, limit, input.cursor);
      requireThat(offset <= indices.length, "cursor_invalid");
      const envelope = (): SemanticEnvelope => failure ? { ok: false, error: { code: failure, message: failure }, partial: page } : { ok: true, value: page };
      const pagination = (next: number) => {
        const truncated = next < indices.length;
        page.page = { truncated, nextCursor: truncated ? this.#cursor(parent, page.viewIdentity, limit, next) : null };
      };
      // Details are optional, complete reason totals are not. Never mutate the frozen capture.
      const fits = () => {
        let bytes = jsonBytes(envelope(), Number.MAX_SAFE_INTEGER);
        while (bytes > SEMANTIC_BOUNDS.pageBytes && page.kind === "search" && page.coverage.exclusions.length > 0) {
          page.coverage.exclusions = page.coverage.exclusions.slice(0, -1);
          page.coverage.exclusionsTruncated = true;
          bytes = jsonBytes(envelope(), Number.MAX_SAFE_INTEGER);
        }
        return bytes <= SEMANTIC_BOUNDS.pageBytes;
      };
      const items: ItemResult[] = page.items;
      pagination(offset);
      requireThat(fits(), "output_limit");
      for (let i = offset; i < Math.min(offset + limit, indices.length); i++) {
        const index = indices[i]!;
        items.push(itemView(parent.prepared.records[index]!, parent.outcomes[index]!, parent.prepared.model, policy, this.parents.snippet(parent.id, index)));
        pagination(i + 1);
        if (!fits()) {
          page.items.pop(); pagination(i);
          requireThat(page.items.length > 0, "output_limit"); break;
        }
      }
      requireThat(jsonBytes(envelope(), Number.MAX_SAFE_INTEGER) <= SEMANTIC_BOUNDS.pageBytes, "output_limit");
      return structuredClone(envelope());
    } catch (error) { const code = errorCode(error, "invalid_input"); return { ok: false, error: { code, message: code } }; }
  }
  evidence(raw: unknown, callOptions: { signal?: AbortSignal } = {}): EvidenceEnvelope | Promise<EvidenceEnvelope> {
    try {
      const input = parseEvidence(raw), parent = this.parents.get(input.operationId);
      requireThat(!parent.busy, "search_busy");
      const selected = input.evidenceIds.map(id => {
        const index = parent.prepared.records.findIndex(r => r.evidence.evidenceId === id);
        requireThat(index >= 0, "invalid_input"); return index;
      });
      const { operationId: _operation, evidenceIds: _ids, ...options } = input;
      const project = (snippets: Snippet[]): EvidenceEnvelope => {
        const result: EvidenceEnvelope = { ok: true, value: { operationId: parent.id, revision: parent.revision,
          snippets, truncated: snippets.some(snippet => snippet.truncated) } };
        requireThat(jsonBytes(result, Number.MAX_SAFE_INTEGER) <= SEMANTIC_BOUNDS.pageBytes, "output_limit");
        return result;
      };
      if (input.checkCurrent && isSearch(parent.prepared)) {
        return this.parents.currentSnippets(parent.id, selected, options, callOptions.signal).then(project).catch(error => {
          const code = errorCode(error, "invalid_input"); return { ok: false, error: { code, message: code } };
        });
      }
      return project(selected.map(index => this.parents.snippet(parent.id, index, options)));
    } catch (error) { const code = errorCode(error, "invalid_input"); return { ok: false, error: { code, message: code } }; }
  }
}
