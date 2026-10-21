import type { Client } from "./contracts.js";
import { requireThat } from "./errors.js";

export interface DiscoveryHost { events: { emit(channel: string, data: unknown): void } }
export interface ConnectionContext { sessionManager: { getSessionId(): string } }
export interface OwnerReply { protocol: 1; ownerId: string; getClient(sessionId: string): Client }
export const DISCOVER = "pi-decision-tools:discover";
export const CONFLICT = "pi-decision-tools:conflict";
export function discover(host: DiscoveryHost): OwnerReply | undefined {
  const replies: unknown[] = [];
  host.events.emit(DISCOVER, { protocol: 1, reply: (value: unknown) => { replies.push(value); } });
  if (replies.length > 1) {
    const ownerIds = replies.flatMap(reply => typeof reply === "object" && reply !== null &&
      "ownerId" in reply && typeof reply.ownerId === "string" ? [reply.ownerId] : []);
    host.events.emit(CONFLICT, { ownerIds });
    requireThat(false, "coordinator_conflict");
  }
  if (!replies.length) return undefined;
  const reply = replies[0];
  requireThat(typeof reply === "object" && reply !== null && "protocol" in reply && reply.protocol === 1 &&
    "ownerId" in reply && typeof reply.ownerId === "string" && reply.ownerId.length > 0 &&
    "getClient" in reply && typeof reply.getClient === "function", "coordinator_incompatible");
  return reply as OwnerReply;
}
/** Explicit discovery only; importing this module performs no host work. */
export function connect(host: DiscoveryHost, context: ConnectionContext): Client {
  const owner = discover(host);
  requireThat(owner, "coordinator_unavailable");
  return owner.getClient(context.sessionManager.getSessionId());
}
