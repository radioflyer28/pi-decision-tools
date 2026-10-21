import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { Limits, Usage } from "../core/contracts.js";
import { LEDGER_TYPE, replayLedger, type EventPayload, type LedgerEvent, type LedgerState } from "../core/ledger.js";
import { ToolkitError, requireThat } from "../core/errors.js";
import { canonicalJson } from "../core/validation.js";

export interface SessionAccess {
  getSessionId(): string;
  getSessionFile(): string | undefined;
  getEntries(): readonly unknown[];
}
type AppendEntry = (customType: string, data: unknown) => void;
type ReadText = (path: string) => string;

/** Synchronous host append/read-back boundary; the owner serializes dispatch around it. */
export class SessionLedger {
  readonly sessionId: string;
  #state: LedgerState;
  #faulted = false;
  #live = new Map<string, boolean>();
  constructor(private readonly session: SessionAccess, private readonly appendEntry: AppendEntry,
    private readonly readText: ReadText = path => readFileSync(path, "utf8")) {
    this.sessionId = session.getSessionId();
    this.#state = replayLedger(session.getEntries(), this.sessionId);
  }
  get faulted(): boolean { return this.#faulted; }
  snapshot(): LedgerState { return structuredClone(this.#state); }
  #fault(): never { this.#faulted = true; throw new ToolkitError("storage_error"); }
  #notReady(): never {
    if (this.#state.policy) this.#fault();
    throw new ToolkitError("persistence_required");
  }
  read(): LedgerState {
    if (this.#faulted) this.#fault();
    try {
      requireThat(this.session.getSessionId() === this.sessionId);
      const memory = replayLedger(this.session.getEntries(), this.sessionId);
      // An initialized ledger cannot be erased by navigation or external truncation.
      requireThat(memory.events.length >= this.#state.events.length);
      for (let i = 0; i < this.#state.events.length; i++)
        requireThat(canonicalJson(memory.events[i]) === canonicalJson(this.#state.events[i]));
      const filename = this.session.getSessionFile();
      if (!filename) this.#notReady();
      let text: string;
      try { text = this.readText(filename); } catch { this.#notReady(); }
      let rows: unknown[];
      try {
        const lines = text!.split(/\r?\n/);
        if (lines.at(-1) === "") lines.pop();
        rows = lines.map(line => JSON.parse(line) as unknown);
      } catch { this.#notReady(); }
      const header = rows![0] as Record<string, unknown> | undefined;
      requireThat(header && header.type === "session" && header.id === this.sessionId);
      const conversation = rows!.slice(1).some(row => {
        if (typeof row !== "object" || row === null) return false;
        const r = row as Record<string, unknown>;
        if (r.type !== "message" || typeof r.message !== "object" || r.message === null) return false;
        const role = (r.message as Record<string, unknown>).role;
        return role === "user" || role === "assistant";
      });
      if (!conversation) this.#notReady();
      const disk = replayLedger(rows!.slice(1), this.sessionId);
      requireThat(disk.events.length === memory.events.length);
      for (let i = 0; i < disk.events.length; i++)
        requireThat(canonicalJson(disk.events[i]) === canonicalJson(memory.events[i]));
      this.#state = disk;
      return this.snapshot();
    } catch (error) {
      if (error instanceof ToolkitError && error.code === "persistence_required") throw error;
      this.#fault();
    }
  }
  #append(payload: EventPayload): void {
    const before = this.read();
    const event: LedgerEvent = { ...payload, version: 1, eventId: randomUUID(), sessionId: this.sessionId,
      sequence: before.sequence + 1 };
    const proposed = replayLedger([...before.events, event].map(data => ({ type: "custom", customType: LEDGER_TYPE, data })), this.sessionId);
    // Keep conservative liability even if append partially succeeds then throws.
    this.#state = proposed;
    try {
      this.appendEntry(LEDGER_TYPE, structuredClone(event));
      const after = this.read();
      requireThat(after.events.at(-1)?.eventId === event.eventId);
    } catch {
      // Unverified refunds/settlements cannot lower known liability. A reservation
      // may have reached disk even when append throws, so keep its full charge.
      this.#state = payload.kind === "reserve" ? proposed : before;
      this.#fault();
    }
  }
  grant(requests: number, inputBytes: number, policy: Limits, initial: boolean): void {
    this.#append({ kind: "grant", requests, inputBytes, policy, initial });
  }
  reserve(inputBytes: number, provider: string, model: string): string {
    const attemptId = randomUUID();
    this.#append({ kind: "reserve", attemptId, requests: 1, inputBytes, provider, model });
    this.#live.set(attemptId, false);
    return attemptId;
  }
  markDispatched(attemptId: string): void {
    this.read();
    requireThat(this.#live.get(attemptId) === false, "invalid_attempt_transition");
    this.#live.set(attemptId, true);
  }
  releaseUndispatched(attemptId: string): void {
    requireThat(this.#live.get(attemptId) === false, "unproven_non_dispatch");
    this.#append({ kind: "release", attemptId, reason: "not_dispatched" });
    this.#live.delete(attemptId);
  }
  settle(attemptId: string, outcome: "answered" | "failed" | "aborted", usage: Usage | null, pricing: "known" | "unknown"): void {
    requireThat(this.#live.get(attemptId) === true, "invalid_attempt_transition");
    this.#append({ kind: "settle", attemptId, outcome, usage, pricing });
    this.#live.delete(attemptId);
  }
}
