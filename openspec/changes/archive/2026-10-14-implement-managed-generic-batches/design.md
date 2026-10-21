# Design

## Context

See proposal.md for motivation. Current inspection found the approved baseline, execution contract, 38 acceptance cases, an archived documentation change, and no runtime, manifest, tests, main specs, or Git metadata. OpenSpec resolves to this repository with spec-driven schema and no configured context/rules. Node is 24.21.0; npm is 11.15.0. Installed Pi is 1.2.0, ESM, requiring Node >=22.19.0.

The installed declarations still expose getAvailableOfType/classify, lifecycle hooks, appendEntry, and the shared event bus described by the execution contract. EventBus emits synchronously, invokes handlers through an async wrapper, and does not await asynchronous replies. The previous documentation change's persistence probes are historical evidence; implementation tests must reproduce them against real temporary Pi sessions.

The managed execution contract and acceptance matrix are the detailed input to implementation. This change turns their behavior into four capability deltas; no source or test implementation is part of this proposal phase.

## Goals / Non-Goals

**Goals:** Deliver the generic path end to end with deterministic correctness, explicit enforcement ownership, failure injection, and a usable local package. Keep all 38 acceptance IDs traceable to tests/procedures, including minimal semantic-consumer fixtures for shared-core requirements.

**Non-Goals:** Build search/filter/evidence algorithms now; treat a fake classifier as semantic-quality evidence; publish; initialize Git unnecessarily; authorize live provider spend; implement durable workspaces or a general host abstraction.

## Decisions

### 1. TypeScript ESM with a minimal build/test toolchain

Use TypeScript strict mode, NodeNext module resolution, compiled ESM and declarations in dist, and Node's built-in test runner against built code. Set the Node engine to the host-compatible >=22.19.0. Use npm and a checked-in lockfile. Runtime exports are the library at the package root and an explicit extension subpath; the Pi manifest points to the extension entry. Package only dist, relevant documentation, manifest and license metadata actually chosen by the maintainer; do not invent a license grant.

Host imports (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, and `typebox` when used) are peer dependencies, not bundled runtime copies. Pin the tested host development version to 1.2.0 in development dependencies. Select and lock compatible TypeScript/@types/node versions during installation, recording exact resolved versions. No provider SDK dependency is needed. Node test avoids an extra test framework; tsc avoids a bundler that could duplicate the host runtime.

### 2. Deep internal modules, narrow public surface

Proposed modules:

- core/contracts and validation: public data types, strict input/result validation, canonicalization, identity and size accounting.
- core/ledger: pure replay/reduction plus serialized mutation through a Pi persistence adapter; contains no evidence/results.
- core/scheduler: global slots and bounded fair batch queue, monotonic deadlines, abort/drain ownership.
- core/coordinator: authorization gates, selected-model policy, ephemeral workspaces, pagination, reuse and usage deltas.
- pi/session-adapter and pi/classifier-adapter: session-file readiness/read-back, lifecycle identity, native discovery/invocation and response metadata.
- pi/owner, commands, config and generic-tools: bus ownership, user controls, atomic config writes, schemas/rendering boundary.
- library entry: exports types and connect only, without creating an executor on import.

Adapters are narrow internal seams for deterministic tests, not a host-independent framework. Core imports must not pull in Pi UI or future semantic-search implementation. Trust the owner to bind consumer kinds; untrusted tool JSON cannot supply consumer identity or enable/replenish operations.

### 3. Owner and lifecycle protocol

Use the execution contract's unversioned discover channel and protocol 1. Synchronous discovery/install prevents two sequential factories from both becoming owner. Consumers wait for session_start to connect; duplicate compatible factories do not register commands/tools a second time. Bind facades to owner session identity and epoch and recheck on every operation.

Make conflict shutdown actionable with a private unversioned `pi-decision-tools:conflict` notification carrying the conflicting owner IDs. Owners synchronously latch dispatch closed when named or when multiple owners are observed. This supplements discovery rather than adding an authorization API to the public facade. Subscribe during factory setup and clean up idempotently with the runtime. Test separate physical compiled copies through actual Pi event-bus wrappers, not only two imports of one module.

Availability refresh is single-flight and publishes its snapshot atomically: concurrent preflight cannot observe a transient empty catalog, stale out-of-order refreshes cannot overwrite failures, and a failed refresh clears availability. Dispatch still awaits a fresh native availability check.

Before-tree and shutdown transitions close dispatch first, then signal and drain attempts. After successful tree navigation, increment generation and clear workspaces/reuse. Cancelled navigation retains data but not automatically restored authorization. Reload/replacement reconstructs ledger from persisted entries and starts disabled. A fork's header session identity prevents inherited parent ledger events from granting new-session allowance. Compaction is not workspace expiry. No stale context may append to the replacement session.

### 4. Fail-closed ledger and linearization points

The persisted-conversation gate is an explicit user decision. Check file existence/readability, matching header, a real persisted user/assistant message, valid JSONL, and agreement between relevant disk events and host entries. Append only through pi.appendEntry; read-back by unique eventId proves reservation visibility before invocation. Never write session JSONL directly or manufacture transcript messages.

Ledger state is reduced from all current-session events in physical order. Validate sequence, unique IDs, version, transitions, safe integer arithmetic, policy, and a single initial grant. Search every toolkit ledger-version namespace for unknown current-session versions, not just the v1 customType. A storage exception latches the coordinator faulted even if the host already mutated its in-memory entries. No retry of a partially successful append may create a second grant/reservation. Reload requires a consistent replay before new work.

Serialize allowance selection, append/read-back, and the final pre-dispatch check. Hold a scheduler slot while making a reservation. If a gate closes before invocation, release only on positive proof of non-dispatch; an unverified release remains charged. Once invocation starts, never release its logical charge, regardless of settlement or missing usage. Unknown settlements remain explicit; fork inheritance and process-crash uncertainty must be tested with persisted files.

The session file is assumed to have one host writer, as documented. No separate journal or persistent evidence store is added. Read-back is not represented as a power-loss fsync guarantee.

### 5. Fair scheduling, cancellation, and retry

Use a round-robin queue of active batches, offering at most one next attempt per visit while global capacity remains. Never schedule every item ahead. A batch has one execution lease but can occupy available global slots with distinct items. Reserve invocation allowance synchronously with session allowance so concurrent items cannot overspend a run ceiling. Per-call deadlines include queue time; native attempt deadlines request abort. Signals combine caller, disable/lifecycle, and deadline causes.

Keep slots held until the underlying native promise settles. This can exceed deadline with an uncooperative provider; report actual elapsed time and do not create detached jobs. Reuse is evaluated before reserving, after the relevant gates. Cache work never takes a classifier slot but must not indefinitely bypass a scheduling deadline.

Set native maxRetries to zero. Observe structured onResponse status for retryability; never parse error text. Retries are fresh attempts with fresh reservations, queued behind other ready work, with a lifetime cap across continuations. Validate retryFailedIds atomically. Keep a previously failed outcome intact until a retry can actually start; no-dispatch budget denial must not falsely change complete-with-failures into unattempted work.

### 6. Bounds and immutable snapshots

Adopt the execution contract's experimental limits without treating them as evaluated optimal defaults. Validate own JSON values before copying; reject cycles, accessor/prototype-bearing non-JSON values, nonfinite numbers, and malformed surrogate sequences. Prototype-looking keys such as __proto__ in otherwise valid JSON must be inert data, not mutable prototypes. Use own-key iteration and null-prototype maps where needed.

Canonicalization sorts object keys and preserves arrays. Match actual returned model identity to the pinned identity; mutable backend aliases remain disclosed. Reuse key omits item IDs but includes full evidence/question/model/policy identity and versions. Memory admission must account for retained serialized state/answers and worst-case answer growth, not only initial inputs; reserve capacity per active item or reject before dispatch if a completed result could exceed the workspace limit. Evict optional reuse entries before rejecting, never live batches. Use shared immutable answer references or count copies accurately.

Pagination uses random cursor tokens stored in the ephemeral workspace, bound to revision and offset. Every run that can change outcomes advances revision before scheduling; rejected preflight calls do not. Serialize the final envelope when enforcing the 128 KiB page limit, including metadata, not just its items. The single-answer cap must ensure at least one valid item can fit; otherwise report an explicit oversized result, not an unusable infinite cursor.

### 7. Reporting, configuration, and host integration

One-shot submit and continue return data plus per-invocation usageDelta. Results/cache retrieval only return cumulative data, not new usage. Preserve Pi Usage fields; do not infer absent pricing from numeric zero. Expose unknown-pricing status rather than using a dollar budget. Default diagnostics omit raw provider error strings and user evidence. If response provider/model identity mismatches the pinned model, reject the answer and attribute any reported usage to stable unknown/unknown labels, never echo arbitrary unverified identity strings or claim they belong to the pinned model. Tool arguments/results may still be persisted by Pi normally; document this distinction.

Configuration lives only in the user agent directory, is validated strictly, and contains no enabled state. Atomic save replaces only after successful validation/write; failed writes retain the previous file. Startup flags must be consumed only by the initial startup event, not merely because the same flag values are visible after reload. Configured policy is frozen by the initial grant; re-enable does not regrant. A first enable before persistence readiness records authorization in memory; the initial grant is created lazily at the first persistence-ready execution under the same serialized gate. Replenish before an initial grant must first initialize the explicitly authorized policy or fail clearly; it must never create a second initial grant.

### 8. Verification strategy and acceptance mapping

Use unit tests for validation, canonicalization, ledger reduction, results/reuse, and scheduler state; integration tests for Pi event bus, actual SessionManager persistence, extension registrations and nested structured output. Add a host loader/SDK integration that uses fake models and temporary config/session directories, not the developer's credentials or default settings. Coverage is a traceability requirement, not just a percentage.

Map EX-01–05 and EX-38 to command/config/authorization tests; EX-06–08 to import/discovery/family tests; EX-09, EX-17–23 to scheduling/attempt/control tests; EX-10–16 and EX-33–34 to validation/batch/results tests; EX-24–30 and EX-37 to ledger/lifecycle/storage tests; EX-31–32 to usage aggregation tests; EX-35 to privacy and adversarial data tests; EX-36 to a minimal semantic parent fixture exercising shared core, cancellation, model pinning and independent parent completeness. Each matrix row may need several tests; an ID appearing in a test name is not proof all its clauses are verified.

The native smoke command is opt-in and refuses execution without an explicit model, finite budget, persisted temporary test session, and operator consent. It sends only a disclosed synthetic fixture. Missing consent or credentials is a visible not-run result, not success. Goal.md has not authorized provider spend, so do not run it during apply without a new authorization. Its implementation and deterministic refusal behavior are part of this change; live model evaluation remains goal phase H and cannot be declared complete from a fake response.

Run typecheck, clean build, deterministic tests, host integration tests, local package/install checks, and strict OpenSpec validation before completion. Review the 38-case traceability document against concrete assertions. Keep the overall goal incomplete until later semantic and evaluation phases are done.

## Risks / Trade-offs

- [Cross-copy integration passes only mocked tests] → Load two physical copies with the installed host bus/loader and assert one registration/enforcement domain.
- [Memory-only append mistaken for durability] → Real-session gate/read-back tests plus crash and injected write-failure paths.
- [Native options unsupported by a provider] → Budget native logical invocations, honor cooperative cancellation honestly, never promise wire-request limits.
- [Usage reporting duplicated by aggregation] → Separate cumulative data from invocation deltas and test nested codemode calls.
- [An implementation shortcut drops a contract case] → Require clause-level EX coverage review, not just a passing test count.
- [Broad first executable slice] → Implement in small ordered tasks with component tests, but do not call the change complete until the entire safe path works.
- [Live validation lacks authorization] → Deliver the explicit smoke entry point and accurate not-run report; retain the later evaluation gate as incomplete.

## Migration Plan

There is no previous runtime or ledger to migrate. Install locally only after build/tests; loading the extension starts disabled. Roll back by disabling/removing the package, not deleting ledger entries or user configuration. Runtime generation changes expire handles by design. Retain protocol/version checks so an incompatible future package fails closed rather than interpreting another version's allowance.
