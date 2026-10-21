import { randomUUID } from "node:crypto";
import type { Answer, ModelIdentity, Outcome, StopReason, Submit, UsageGroup } from "./contracts.js";
import { requireThat } from "./errors.js";
import { BOUNDS, identity, jsonBytes, parseAnswers, parseSubmit } from "./validation.js";
import { RetainedMemory, type MemoryToken } from "./memory.js";

export interface Batch {
  id: string; identity: string; model: ModelIdentity; input: Omit<Submit, "run">;
  outcomes: Outcome[]; busy: boolean; revision: number; stopReason: StopReason;
  inputBytes: number; answerBytes: number;
  diagnostics: { attempts: number; cacheHits: number; elapsedMs: number; unknownUsageAttempts: number };
  usage: UsageGroup[];
}
interface Growth { batchId: string; bytes: number; allocation: MemoryToken }
/** Ephemeral state only. The coordinator owns these mutable internal records. */
export class Workspaces {
  #batches = new Map<string, Batch>();
  #growth = new Map<string, Growth>();
  #allocations = new Map<string, MemoryToken>();
  constructor(readonly memory = new RetainedMemory()) {}
  get size(): number { return this.#batches.size; }
  get retainedBytes(): number { return this.memory.retainedBytes; }
  get reservedBytes(): number { return this.memory.reservedBytes; }
  prepare(raw: unknown, model: ModelIdentity): Batch {
    const parsed = parseSubmit(raw);
    const { run: _run, ...input } = parsed;
    const inputBytes = jsonBytes(input);
    requireThat(this.size < BOUNDS.batches && inputBytes <= this.memory.availableBytes, "workspace_full");
    const pinned = structuredClone(model);
    const batch: Batch = { id: randomUUID(), identity: identity({ input, model: pinned, contractVersion: 1 }),
      model: pinned, input, outcomes: input.items.map(item => ({ id: item.id, inputVersion: item.inputVersion, status: "pending", attempts: 0 })),
      busy: false, revision: 0, stopReason: "prepared", inputBytes, answerBytes: 0,
      diagnostics: { attempts: 0, cacheHits: 0, elapsedMs: 0, unknownUsageAttempts: 0 }, usage: [] };
    const allocation = this.memory.allocate(inputBytes);
    this.#allocations.set(batch.id, allocation); this.#batches.set(batch.id, batch);
    return batch;
  }
  get(id: string): Batch {
    const batch = this.#batches.get(id);
    requireThat(batch, "batch_expired"); return batch;
  }
  acquire(id: string): Batch {
    const batch = this.get(id); requireThat(!batch.busy, "batch_busy");
    batch.busy = true; batch.revision++; return batch;
  }
  finish(id: string): void { this.get(id).busy = false; }
  reserveAnswer(id: string, bytes: number = BOUNDS.answerBytes): string {
    const batch = this.get(id); requireThat(batch.busy, "batch_not_running");
    requireThat(Number.isSafeInteger(bytes) && bytes >= 0 && bytes <= BOUNDS.answerBytes, "invalid_input");
    const token = randomUUID(), allocation = this.memory.allocate(0, bytes);
    this.#growth.set(token, { batchId: id, bytes, allocation });
    return token;
  }
  discardAnswer(token: string): void {
    const growth = this.#growth.get(token);
    if (!growth) return;
    this.memory.release(growth.allocation); this.#growth.delete(token);
  }
  completeAnswer(token: string, index: number, raw: unknown,
    origin: "provider" | "reuse" = "provider", judgmentId: string = randomUUID()): Record<string, Answer> {
    const growth = this.#growth.get(token); requireThat(growth, "invalid_answer_reservation");
    const batch = this.get(growth.batchId), previous = batch.outcomes[index];
    requireThat(previous && previous.status !== "completed", "invalid_item_transition");
    const answers = parseAnswers(raw, batch.input.questions), bytes = jsonBytes(answers, BOUNDS.answerBytes);
    requireThat(bytes <= growth.bytes, "workspace_full");
    const abstainedQuestionIds = Object.entries(answers).filter(([key, answer]) => answer.type === "choice" &&
      batch.input.abstainChoices?.[key]?.includes(answer.choice)).map(([key]) => key);
    this.memory.commitGrowth(growth.allocation, this.#allocations.get(batch.id)!, bytes);
    batch.outcomes[index] = { id: previous.id, inputVersion: previous.inputVersion, attempts: previous.attempts,
      status: "completed", answers, abstainedQuestionIds, origin, judgmentId };
    this.#growth.delete(token); batch.answerBytes += bytes;
    return answers;
  }
  release(id: string): void {
    const batch = this.get(id); requireThat(!batch.busy, "batch_busy");
    requireThat(![...this.#growth.values()].some(growth => growth.batchId === id), "batch_busy");
    this.memory.release(this.#allocations.get(id)!); this.#allocations.delete(id); this.#batches.delete(id);
  }
  clear(): void {
    requireThat(![...this.#batches.values()].some(batch => batch.busy), "batch_busy");
    for (const growth of this.#growth.values()) this.memory.release(growth.allocation);
    for (const allocation of this.#allocations.values()) this.memory.release(allocation);
    this.#batches.clear(); this.#growth.clear(); this.#allocations.clear();
  }
}
