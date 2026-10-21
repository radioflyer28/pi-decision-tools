import type { CapturedScope } from "../filesystem/capture.js";
import { recordUsage } from "../core/results.js";
import { recordSnippet } from "./views.js";
import type { EvidenceInput, Snippet } from "./schemas.js";
import { randomUUID } from "node:crypto";
import type { Item, Outcome, UsageGroup } from "../core/contracts.js";
import type { Coordinator } from "../core/coordinator.js";
import type { MemoryToken } from "../core/memory.js";
import { requireThat, ToolkitError } from "../core/errors.js";
import { jsonBytes } from "../core/validation.js";
import { ABSTAIN_CHOICES, QUESTIONS, recordItem, isSearch, type Prepared } from "./preparation.js";
import { SEMANTIC_BOUNDS } from "./validation.js";
import type { SemanticPage } from "./schemas.js";

export interface Child { batchId: string; identity: string; start: number; count: number; retired?: boolean }
export interface Parent {
  id: string; prepared: Prepared; revision: number; busy: boolean;
  children: Child[]; outcomes: Outcome[]; stopReason: SemanticPage["stopReason"];
  diagnostics: SemanticPage["diagnostics"]; usage: UsageGroup[];
  discovery?: { targetMatches: number; latestJudgedIds: string[] };
  retiredUsage?: UsageGroup[];
  retiredDiagnostics?: Pick<SemanticPage["diagnostics"], "attempts" | "cacheHits" | "unknownUsageAttempts">;
}
interface Stored { data: Parent; allocation: MemoryToken; capacity: number; capture?: CapturedScope }
type Patch = Partial<Pick<Parent, "revision" | "busy" | "children" | "outcomes" | "stopReason" | "diagnostics" | "usage" | "retiredUsage" | "retiredDiagnostics" | "discovery">>;

/** Conservative growth bound for this fixed three-choice rubric, not the generic 64 KiB answer cap.
 * Each outcome has <=4 numeric probabilities/confidence (32 serialized bytes each), bounded IDs,
 * stable errors and fixed keys/labels: 4096 bytes covers even 6-byte escaping of 128-byte IDs.
 * Each eight-item child's metadata fits 512 bytes. Four model-sized usage labels plus 4096 bytes
 * cover known/unknown usage groups and counters. Parent data is measured again at every update.
 */
export function parentGrowthBytes(prepared: Prepared): number {
  return prepared.records.length * 4096 + Math.ceil(prepared.records.length / SEMANTIC_BOUNDS.childItems) * 512 +
    4 * jsonBytes(prepared.model, Number.MAX_SAFE_INTEGER) + 4096;
}
/** All retained parent copies and reserved growth compete with core batches in the same pool. */
export class SemanticParents {
  #parents = new Map<string, Stored>();
  #preparing = new Set<string>();
  #reads = new Map<AbortController, Promise<void>>();
  #closingReads = false;
  constructor(readonly core: Coordinator) {}
  get size(): number { return this.#parents.size; }
  #stored(id: string): Stored {
    const stored = this.#parents.get(id); requireThat(stored, "search_expired"); return stored;
  }
  get(id: string): Parent { return this.#stored(id).data; }
  snippet(id: string, index: number, options: Pick<EvidenceInput, "startOffsetLines" | "maxLines" | "maxBytes"> = {}): Snippet {
    const stored = this.#stored(id), record = stored.data.prepared.records[index]!;
    if ("text" in record) return recordSnippet(record, options);
    requireThat(stored.capture, "source_unverifiable");
    return stored.capture.snippet(record.evidence.evidenceId, options.startOffsetLines, options.maxLines, options.maxBytes);
  }
  cancelReads(): void { for (const controller of this.#reads.keys()) controller.abort("disabled"); }
  closeReads(): void { this.#closingReads = true; this.cancelReads(); }
  async drainReads(): Promise<void> { await Promise.all(this.#reads.values()); }
  async currentSnippets(id: string, indices: number[], options: Pick<EvidenceInput, "startOffsetLines" | "maxLines" | "maxBytes">, signal?: AbortSignal): Promise<Snippet[]> {
    requireThat(!this.#closingReads, "search_expired");
    requireThat(!signal?.aborted, "cancelled");
    const stored = this.#stored(id); requireThat(!stored.data.busy, "search_busy");
    requireThat(stored.capture, "source_unverifiable");
    this.update(id, { busy: true });
    let done!: () => void;
    const controller = new AbortController(), cancel = () => controller.abort("cancelled");
    signal?.addEventListener("abort", cancel, { once: true });
    const lease = new Promise<void>(resolve => { done = resolve; }); this.#reads.set(controller, lease);
    const check = () => {
      requireThat(!this.#closingReads, "search_expired");
      requireThat(!controller.signal.aborted, controller.signal.reason === "disabled" ? "disabled" : "cancelled");
    };
    try {
      const snippets = indices.map(index => this.snippet(id, index, options));
      for (const snippet of snippets) {
        if (snippet.path !== null) snippet.freshness = await stored.capture.freshness(snippet.evidenceId, controller.signal);
      }
      check();
      return snippets;
    } catch (error) { check(); throw error; }
    finally {
      signal?.removeEventListener("abort", cancel);
      try { this.update(id, { busy: false }); }
      finally { this.#reads.delete(controller); done(); }
    }
  }
  admit(prepared: Prepared, capture?: CapturedScope): Parent {
    requireThat(this.size < SEMANTIC_BOUNDS.parents, "workspace_full");
    const data: Parent = { id: `sem-${randomUUID()}`, prepared, revision: 0, busy: false, children: [],
      ...(isSearch(prepared) && prepared.mode === "discovery" ? { discovery: { targetMatches: prepared.targetMatches ?? 5, latestJudgedIds: [] } } : {}),
      outcomes: prepared.records.map(({ evidence }) => ({ id: evidence.evidenceId, inputVersion: evidence.inputVersion, status: "pending", attempts: 0 })),
      stopReason: "prepared", diagnostics: { attempts: 0, cacheHits: 0, elapsedMs: 0, unknownUsageAttempts: 0 }, usage: [] };
    const bytes = jsonBytes(data, Number.MAX_SAFE_INTEGER), growth = parentGrowthBytes(prepared);
    const allocation = this.core.memory.allocate(bytes, growth);
    this.#parents.set(data.id, { data, allocation, capacity: bytes + growth, ...(capture ? { capture } : {}) });
    return data;
  }
  update(id: string, patch: Patch): Parent {
    const stored = this.#stored(id), candidate = { ...stored.data, ...structuredClone(patch) };
    const bytes = jsonBytes(candidate, Number.MAX_SAFE_INTEGER);
    requireThat(bytes <= stored.capacity, "workspace_full");
    this.core.memory.resize(stored.allocation, bytes, stored.capacity - bytes);
    stored.data = candidate; return candidate;
  }
  acquire(id: string): Parent {
    const parent = this.get(id); requireThat(!parent.busy, "search_busy");
    requireThat(parent.revision < Number.MAX_SAFE_INTEGER, "search_expired");
    return this.update(id, { busy: true, revision: parent.revision + 1 });
  }
  finish(id: string): void { this.update(id, { busy: false }); }
  /** Prepare one child only after the preceding child settles. Preparation never dispatches. */
  async prepareChild(id: string): Promise<Child> {
    const parent = this.get(id);
    requireThat(parent.busy && !this.#preparing.has(id), "search_busy");
    const last = parent.children.at(-1);
    if (last && !last.retired) {
      const batch = this.core.workspaces.get(last.batchId);
      requireThat(!batch.busy && batch.outcomes.every(o => o.status === "completed" || o.status === "failed"), "search_busy");
    }
    const start = last ? last.start + last.count : 0;
    const records = parent.prepared.records.slice(start, start + SEMANTIC_BOUNDS.childItems);
    requireThat(records.length > 0, "invalid_input");
    this.#preparing.add(id);
    try {
      const result = await this.core.submitManaged({ items: records.map(r => "text" in r ? recordItem(r, parent.prepared.predicate) :
        this.#stored(id).capture!.item(r.evidence.evidenceId, parent.prepared.predicate) as Item),
        rubricVersion: "semantic-v1", questions: QUESTIONS, abstainChoices: ABSTAIN_CHOICES }, "semantic", {}, parent.prepared.model);
      if (!result.data.ok) {
        // Even failed public-page projection can have admitted a batch. It has no parent owner yet.
        if (result.batchId) this.core.release(result.batchId);
        if (result.data.error.code === "workspace_full") this.update(id, { stopReason: "workspace_full" });
        throw new ToolkitError(result.data.error.code);
      }
      const child = { batchId: result.data.value.batchId, identity: result.data.value.identity, start, count: records.length };
      try { this.update(id, { children: [...parent.children, child] }); }
      catch (error) { this.core.release(child.batchId); throw error; }
      return child;
    } finally { this.#preparing.delete(id); }
  }
  /** Copy actual core outcomes; raw answers remain separately charged in both owners. */
  capture(id: string): Parent {
    const parent = this.get(id), outcomes = [...parent.outcomes];
    for (const child of parent.children) {
      if (child.retired) continue;
      const batch = this.core.workspaces.get(child.batchId);
      requireThat(!batch.busy, "search_busy");
      for (let i = 0; i < child.count; i++) outcomes[child.start + i] = batch.outcomes[i]!;
    }
    return this.update(id, { outcomes });
  }
  /** File searches may outgrow32 children; retire only settled children with no retry obligation.
   * Record parents keep their existing bounded reuse lifetime. Preserve measured aggregate copies. */
  retireSettled(id: string): void {
    if (!isSearch(this.get(id).prepared)) return;
    for (const child of this.get(id).children) {
      if (child.retired) continue;
      const batch = this.core.workspaces.get(child.batchId);
      if (batch.busy || batch.outcomes.some(o => o.status === "pending" || o.status === "running" ||
        (o.status === "failed" && o.error.retryEligible))) continue;
      const parent = this.get(id), usage = structuredClone(parent.retiredUsage ?? []);
      for (const group of batch.usage) recordUsage(usage, group.provider, group.model, group.usage, group.pricing);
      const previous = parent.retiredDiagnostics ?? { attempts: 0, cacheHits: 0, unknownUsageAttempts: 0 };
      this.update(id, { children: parent.children.map(c => c.batchId === child.batchId ? { ...c, retired: true } : c),
        retiredUsage: usage, retiredDiagnostics: { attempts: previous.attempts + batch.diagnostics.attempts,
          cacheHits: previous.cacheHits + batch.diagnostics.cacheHits,
          unknownUsageAttempts: previous.unknownUsageAttempts + batch.diagnostics.unknownUsageAttempts } });
      this.core.release(child.batchId);
    }
  }
  release(id: string): void {
    const stored = this.#stored(id);
    requireThat(!stored.data.busy && !this.#preparing.has(id), "search_busy");
    for (const child of stored.data.children) if (!child.retired) requireThat(!this.core.workspaces.get(child.batchId).busy, "search_busy");
    for (const child of stored.data.children) if (!child.retired) this.core.release(child.batchId);
    stored.capture?.release();
    this.core.memory.release(stored.allocation); this.#parents.delete(id);
  }
  clear(): void {
    for (const { data } of this.#parents.values()) {
      requireThat(!data.busy && !this.#preparing.has(data.id), "search_busy");
      for (const child of data.children) if (!child.retired) requireThat(!this.core.workspaces.get(child.batchId).busy, "search_busy");
    }
    for (const id of this.#parents.keys()) this.release(id);
  }
}
