# Design

## Context

See proposal.md for motivation. Inspection found one 347-line conceptual baseline, an OpenSpec config selecting `spec-driven` without project context or artifact rules, and no implementation, manifest, tests, or existing capability specs. The baseline is approved conceptually but explicitly marks host integration details and numerical defaults unsettled. This change produces documentation; installed Pi interfaces have not been verified by this proposal and must not be presented as established integration facts.

The reader is the contributor implementing the first managed generic-batch feature. After reading the deliverables, that contributor should be able to implement the bounded slice without inventing authorization, lifecycle, or accounting semantics.

## Goals / Non-Goals

**Goals:** Translate baseline sections 2, 3.3–3.4, and 7–9 into one internally consistent execution contract and traceable acceptance cases. Identify concrete host support for the mechanisms chosen. Separate proposed toolkit interfaces from existing Pi APIs.

**Non-Goals:** Implement or publish the toolkit; settle semantic-search quality policy; introduce persistent evidence/results; claim the eventual executable feature is verified by document validation.

## Decisions

### 1. Use a bounded contract-first change

Deliver two focused documents plus a README index. The contract contains decisions and examples; the acceptance document contains inputs, events, expected outcomes, and baseline traceability. Do not duplicate the entire conceptual baseline or relocate it in this slice.

Alternative: implement a full generic batch immediately. Rejected because the baseline explicitly requires coordinator and lifecycle decisions before implementation, and the repository contains no established host integration to reuse. This preparatory slice ends with a concrete next implementation boundary, not an open-ended research backlog.

### 2. Organize the contract around externally observable transitions

The document outline is:

1. Status, audience, baseline authority, checked Pi version, and terminology.
2. Extension/library boundaries and coordinator ownership/access/version negotiation.
3. User commands, configuration, model selection, and noninteractive opt-in.
4. Minimal generic batch operations and structured request/result examples.
5. Authorization, batch/item, and session lifecycle transition tables.
6. Reservation, dispatch, retry, reconciliation, and persistence accounting.
7. Failure taxonomy, usage reporting, privacy, and acceptance-case links.
8. Next executable slice and explicitly deferred work.

The acceptance matrix uses stable case IDs. Every case names initial state, triggering event, observable result, provider-call expectations, accounting expectations, and its originating baseline section. Examples are proposed toolkit contracts, not fabricated observations from a running system.

### 3. Resolve a finite host-integration checklist

Applying this documentation change must inspect installed Pi extension, model, codemode, and session documentation and relevant examples, following their related documentation references. Record the installed version and exact supporting API/source references for:

- Native classifier discovery, typed questions, invocation, cancellation, usage, and failure information.
- Structured tool output and codemode exposure, independent of tool-family authorization.
- Cross-copy coordinator discovery, ownership, compatibility negotiation, and duplicate registration prevention.
- Session identity and events for reopening, switching, branching, forking, and extension reload.
- Normal Pi persistence facilities sufficient for a cumulative ledger that cannot rewind through branch navigation, including reservation recovery after interrupted calls.

These are targeted feasibility questions, not a generic codebase-exploration task. For each, record verified support, the selected approach, and limitations. If Pi cannot support a baseline invariant, document the precise conflict and stop for a user decision; do not silently relax the baseline or declare the contract implementation-ready. No fallback host abstraction or sidecar evidence store is authorized.

### 4. Preserve the baseline invariants while choosing concrete interfaces

The contract must choose names and schemas for submit/execute, retrieve, and continue operations and the small experimental library interface. Define bounded inputs, duplicate-ID handling, question/input/model identity, pagination, per-item outcomes, batch stop reasons, and explicit expired-handle errors. Preserve native choice/bool/score semantics without importing semantic match categories into generic answers. Show partial completion and continuation without rerunning successful items. Specify reuse eligibility and account cache hits separately from provider calls.

Define one explicit coordinator owner and compatible access mechanism shared across package copies. Imports must remain side-effect-free; neither a hidden tool nor a direct library call may bypass execution-time authorization. The document must distinguish toolkit scope from unrelated native classifier calls.

Choose disable/cancel and model-switch behavior, including already-dispatched work and pinned unfinished batches. Resolve fork/branch/switch/reload handle scope conservatively; separate ephemeral workspaces from persistent cumulative accounting. Defaults never authorize execution, and reopening requires new authorization. Explicit user replenishment is distinct from re-enabling.

Specify deterministic request and input-volume units, when reservations become liabilities, same-model retry charging, concurrency ownership, conservative unknown usage, and how aggregate results avoid duplicate usage reporting. Agent-requested limits can lower but not raise user ceilings. Any numeric defaults selected here must be labeled experimental, not empirically validated.

### 5. Make handoff readiness falsifiable

The acceptance matrix must cover disabled execution through every entry point; ambiguous and unavailable models; incompatible and duplicate library copies; parallel consumers sharing concurrency and allowance; continuation preserving answers; same-model retries; identity mismatch and reuse; invalid output versus provider failure; cancellation with in-flight work; exhausted limits; unknown usage after interruption; reopen and expired handles; branch navigation without budget rewind; fork isolation; explicit replenishment; and absence of source-text logging by default.

The next proposed executable slice should deliver the single-package shared coordinator and minimal generic batch path with fake-provider deterministic tests first, then a separately opted-in native classifier smoke test. Its scope must be derived from the completed contract. Semantic tools follow later and must reuse this execution path. The contract must state that generic batch completion cannot establish parent search coverage.

## Risks / Trade-offs

- [Documentation delays a runnable demonstration] → Keep the output to the finite checklist, contract, and acceptance matrix; do not expand into complete semantic tooling design.
- [Installed Pi cannot meet non-rewinding accounting or cross-copy ownership] → Record concrete evidence and escalate the conflict before claiming readiness, rather than inventing an integration mechanism.
- [Examples are mistaken for implemented APIs] → Mark the documents as proposed/unimplemented and distinguish toolkit designs from verified host APIs.
- [A contract becomes another conceptual overview] → Require exact schemas, state transitions, failure cases, and a named next executable slice.
- [Premature performance guarantees] → No latency, quality, or cost claims; numerical defaults remain explicitly experimental pending evaluation.

## Migration Plan

No runtime migration or deployment is involved. Add the two documents and link them from README while retaining the baseline. Review against the baseline and acceptance matrix. Reverting those documentation additions rolls back this change without touching runtime or persisted state.
