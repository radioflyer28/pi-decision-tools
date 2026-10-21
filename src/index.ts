/** Experimental side-effect-free library entry. Connect explicitly after session_start. */
export const protocolVersion = 1 as const;
export type { Json, JsonObject, Question, Answer, Run, Item, Submit, Results, Continue,
  ModelKey, ModelIdentity, Limits, Configuration, Consumer, Outcome, StopReason, LedgerTotals,
  UsageGroup, BatchPage, Envelope, ExecutionResult, CallOptions, Client, Usage } from "./core/contracts.js";
export { connect } from "./core/discovery.js";
export type { DiscoveryHost, ConnectionContext } from "./core/discovery.js";
