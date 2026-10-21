import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { BatchPage, LedgerTotals, Usage, UsageGroup } from "./contracts.js";
import type { Batch } from "./workspaces.js";
import { requireThat } from "./errors.js";
import { parseUsage } from "./ledger.js";
import { BOUNDS } from "./validation.js";

export function sumUsage(a: Usage | undefined, b: Usage): Usage {
  if (!a) return parseUsage(b);
  const sum: Usage = { input: a.input + b.input, output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead, cacheWrite: a.cacheWrite + b.cacheWrite,
    totalTokens: a.totalTokens + b.totalTokens,
    cost: { input: a.cost.input + b.cost.input, output: a.cost.output + b.cost.output,
      cacheRead: a.cost.cacheRead + b.cost.cacheRead, cacheWrite: a.cost.cacheWrite + b.cost.cacheWrite,
      total: a.cost.total + b.cost.total } };
  if (a.reasoning !== undefined || b.reasoning !== undefined) sum.reasoning = (a.reasoning ?? 0) + (b.reasoning ?? 0);
  if (a.cacheWrite1h !== undefined || b.cacheWrite1h !== undefined) sum.cacheWrite1h = (a.cacheWrite1h ?? 0) + (b.cacheWrite1h ?? 0);
  return parseUsage(sum);
}
export function recordUsage(groups: UsageGroup[], provider: string, model: string, usage: Usage | null, pricing: "known" | "unknown"): void {
  const group = groups.find(g => g.provider === provider && g.model === model);
  if (!group) { groups.push({ provider, model, usage: usage && parseUsage(usage), pricing }); return; }
  if (usage) group.usage = sumUsage(group.usage ?? undefined, usage);
  if (pricing === "unknown") group.pricing = "unknown";
}
interface CursorSlot { id: string; offset: number }
/** Random stored cursor slots plus authenticated revision: bounded across unlimited runs. */
export class ResultPages {
  #secret = randomBytes(32);
  #slots = new Map<string, Map<number, CursorSlot>>();
  #mac(batchId: string, id: string, revision: number): string {
    return createHmac("sha256", this.#secret).update(`${batchId}:${id}:${revision}`).digest("base64url");
  }
  #token(batch: Batch, offset: number): string {
    let slots = this.#slots.get(batch.id);
    if (!slots) { slots = new Map(); this.#slots.set(batch.id, slots); }
    let slot = slots.get(offset);
    if (!slot) { slot = { id: randomUUID(), offset }; slots.set(offset, slot); }
    return `${slot.id}.${batch.revision}.${this.#mac(batch.id, slot.id, batch.revision)}`;
  }
  #offset(batch: Batch, cursor?: string): number {
    if (!cursor) return 0;
    const [id, revisionText, mac, extra] = cursor.split(".");
    requireThat(id && revisionText && mac && extra === undefined && /^(0|[1-9]\d*)$/.test(revisionText), "cursor_invalid");
    const revision = Number(revisionText);
    requireThat(Number.isSafeInteger(revision), "cursor_invalid");
    const slot = [...(this.#slots.get(batch.id)?.values() ?? [])].find(s => s.id === id);
    requireThat(slot, "cursor_invalid");
    const expected = Buffer.from(this.#mac(batch.id, id, revision)), supplied = Buffer.from(mac);
    requireThat(expected.length === supplied.length && timingSafeEqual(expected, supplied), "cursor_invalid");
    requireThat(revision === batch.revision, "cursor_stale");
    return slot.offset;
  }
  page(batch: Batch, ledger: LedgerTotals, cursor?: string, limit = 20, error?: { code: string; message: string }): BatchPage {
    requireThat(!batch.busy, "batch_busy");
    const offset = this.#offset(batch, cursor);
    const counts = { total: batch.outcomes.length, completed: 0, failed: 0, pending: 0, running: 0 };
    for (const outcome of batch.outcomes) counts[outcome.status]++;
    const complete = counts.completed + counts.failed === counts.total;
    const page: BatchPage = { batchId: batch.id, identity: batch.identity, model: batch.model,
      rubricVersion: batch.input.rubricVersion,
      state: complete ? "complete" : batch.stopReason === "prepared" ? "prepared" : "partial",
      counts, stopReason: batch.stopReason, items: [], page: { nextCursor: null, truncated: false },
      diagnostics: batch.diagnostics, usage: batch.usage, ledger };
    let end = Math.min(offset + limit, batch.outcomes.length);
    for (;;) {
      page.items = batch.outcomes.slice(offset, end);
      page.page = { nextCursor: end < batch.outcomes.length ? this.#token(batch, end) : null, truncated: end < batch.outcomes.length };
      const envelope = error ? { ok: false, error, batch: page } : { ok: true, value: page };
      if (Buffer.byteLength(JSON.stringify(envelope), "utf8") <= BOUNDS.pageBytes) return structuredClone(page);
      requireThat(end > offset + 1, "result_too_large");
      end--;
    }
  }
  release(batchId: string): void { this.#slots.delete(batchId); }
  clear(): void { this.#slots.clear(); this.#secret = randomBytes(32); }
}
