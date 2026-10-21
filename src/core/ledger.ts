import type { LedgerTotals, Limits, Usage } from "./contracts.js";
import { ToolkitError, requireThat } from "./errors.js";
import { canonicalJson, copyJson, exact, identifier, integer, parseLimits } from "./validation.js";

export const LEDGER_TYPE = "pi-decision-tools.ledger.v1";
const LEDGER_NAMESPACE = "pi-decision-tools.ledger";
interface Base { version: 1; eventId: string; sessionId: string; sequence: number }
export type EventPayload =
  | { kind: "grant"; requests: number; inputBytes: number; policy: Limits; initial: boolean }
  | { kind: "reserve"; attemptId: string; requests: 1; inputBytes: number; provider: string; model: string }
  | { kind: "settle"; attemptId: string; outcome: "answered" | "failed" | "aborted"; usage: Usage | null; pricing: "known" | "unknown" }
  | { kind: "release"; attemptId: string; reason: "not_dispatched" };
export type LedgerEvent = Base & EventPayload;
export interface Reservation {
  event: Extract<LedgerEvent, { kind: "reserve" }>;
  status: "reserved" | "settled" | "released";
  settlement?: Extract<LedgerEvent, { kind: "settle" }>;
}
export interface LedgerState {
  sessionId: string;
  sequence: number;
  policy: Limits | null;
  events: LedgerEvent[];
  attempts: Map<string, Reservation>;
  totals: LedgerTotals;
}
function nonnegative(value: unknown): void {
  requireThat(typeof value === "number" && Number.isFinite(value) && value >= 0);
}
export function parseUsage(input: unknown): Usage {
  const obj = exact(copyJson(input), ["input", "output", "cacheRead", "cacheWrite", "totalTokens", "cost"], ["cacheWrite1h", "reasoning"]);
  for (const [key, value] of Object.entries(obj)) if (key !== "cost") nonnegative(value);
  const cost = exact(obj.cost, ["input", "output", "cacheRead", "cacheWrite", "total"]);
  Object.values(cost).forEach(nonnegative);
  return obj as unknown as Usage;
}
export function isLedgerEntry(entry: unknown): entry is { type: "custom"; customType: string; data: unknown } {
  if (typeof entry !== "object" || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return e.type === "custom" && typeof e.customType === "string" &&
    (e.customType === LEDGER_NAMESPACE || e.customType.startsWith(LEDGER_NAMESPACE + "."));
}
function parseEvent(input: unknown): LedgerEvent {
  const data = copyJson(input);
  requireThat(typeof data === "object" && data !== null && !Array.isArray(data));
  const base = ["version", "eventId", "sessionId", "sequence", "kind"];
  const keys = data.kind === "grant" ? ["requests", "inputBytes", "policy", "initial"] :
    data.kind === "reserve" ? ["attemptId", "requests", "inputBytes", "provider", "model"] :
    data.kind === "settle" ? ["attemptId", "outcome", "usage", "pricing"] :
    data.kind === "release" ? ["attemptId", "reason"] : [];
  requireThat(keys.length > 0);
  const e = exact(data, [...base, ...keys]);
  requireThat(e.version === 1); identifier(e.eventId); identifier(e.sessionId); integer(e.sequence, 1);
  if (e.kind === "grant") {
    integer(e.requests); integer(e.inputBytes); parseLimits(e.policy); requireThat(typeof e.initial === "boolean");
  } else {
    identifier(e.attemptId);
    if (e.kind === "reserve") {
      requireThat(e.requests === 1); integer(e.inputBytes);
      requireThat(typeof e.provider === "string" && e.provider.length > 0 && typeof e.model === "string" && e.model.length > 0);
    } else if (e.kind === "settle") {
      requireThat(e.outcome === "answered" || e.outcome === "failed" || e.outcome === "aborted");
      requireThat(e.pricing === "known" || e.pricing === "unknown");
      if (e.usage !== null) parseUsage(e.usage);
    } else requireThat(e.reason === "not_dispatched");
  }
  return e as unknown as LedgerEvent;
}
function add(a: number, b: number): number { return integer(a + b); }

/** All physical entries, never the active branch. Every inconsistency fails closed. */
export function replayLedger(entries: readonly unknown[], sessionId: string): LedgerState {
  try {
    identifier(sessionId);
    const state: LedgerState = { sessionId, sequence: 0, policy: null, events: [], attempts: new Map(),
      totals: { grantedRequests: 0, chargedRequests: 0, remainingRequests: 0,
        grantedInputBytes: 0, chargedInputBytes: 0, remainingInputBytes: 0, unknownAttempts: 0 } };
    const seen = new Set<string>();
    for (const entry of entries) {
      if (!isLedgerEntry(entry)) continue;
      const raw = entry.data;
      requireThat(typeof raw === "object" && raw !== null && !Array.isArray(raw));
      const foreignId = (raw as Record<string, unknown>).sessionId;
      requireThat(typeof foreignId === "string" && foreignId.length > 0);
      if (foreignId !== sessionId) continue;
      requireThat(entry.customType === LEDGER_TYPE);
      const event = parseEvent(raw);
      requireThat(event.sequence > state.sequence && !seen.has(event.eventId));
      seen.add(event.eventId); state.sequence = event.sequence; state.events.push(event);
      const t = state.totals;
      if (event.kind === "grant") {
        if (!state.policy) {
          requireThat(event.initial && event.requests === event.policy.requests && event.inputBytes === event.policy.inputBytes);
          state.policy = event.policy;
        } else requireThat(!event.initial && canonicalJson(event.policy) === canonicalJson(state.policy));
        t.grantedRequests = add(t.grantedRequests, event.requests);
        t.grantedInputBytes = add(t.grantedInputBytes, event.inputBytes);
      } else {
        requireThat(state.policy !== null);
        if (event.kind === "reserve") {
          requireThat(!state.attempts.has(event.attemptId));
          t.chargedRequests = add(t.chargedRequests, 1);
          t.chargedInputBytes = add(t.chargedInputBytes, event.inputBytes);
          t.unknownAttempts = add(t.unknownAttempts, 1);
          state.attempts.set(event.attemptId, { event, status: "reserved" });
        } else {
          const attempt = state.attempts.get(event.attemptId);
          requireThat(attempt && attempt.status === "reserved");
          if (event.kind === "release") {
            attempt.status = "released";
            t.chargedRequests--; t.chargedInputBytes -= attempt.event.inputBytes; t.unknownAttempts--;
          } else {
            attempt.status = "settled"; attempt.settlement = event;
            if (event.usage !== null) t.unknownAttempts--;
          }
        }
      }
      t.remainingRequests = integer(t.grantedRequests - t.chargedRequests);
      t.remainingInputBytes = integer(t.grantedInputBytes - t.chargedInputBytes);
    }
    return state;
  } catch { throw new ToolkitError("storage_error"); }
}
