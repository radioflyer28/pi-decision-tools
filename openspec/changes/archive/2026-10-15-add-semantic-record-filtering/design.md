# Design

## Context

See proposal.md for scope. The implemented source has one Coordinator and SessionOwner, generic tools registered on session_start, shared native scheduling/ledger enforcement and a side-effect-free library facade. Workspaces currently owns private batch-only retained/reserved counters; Coordinator creates a new invocation budget/scope for every child call and returns native Usage, not deterministic charged-unit deltas. SessionOwner.pause currently drains only the coordinator. The semantic parent in test/helpers is a fixture, not production filtering. The installed package check currently asserts exactly three registered tools.

The implementation handoff is docs/semantic-contract.md, especially sections 2–6 and record portions of 8–9, with SM-01–15/32–34 in docs/semantic-acceptance.md. All four main specs were inspected, including existing scenarios. The existing lifecycle scenario's unqualified batch_expired needs clarification for semantic handles; generic behavior remains unchanged. This proposal introduces one new capability and three bounded modifications, not a replacement execution framework.

## Goals / Non-Goals

**Goals:** Implement record filtering end to end, including useful captured-text output, zero-call views, explicit partial progress and operational failures; prove shared execution under concurrent real tool/library paths with fake classifiers. Preserve Phase A regressions and the Phase B evidence/authorization boundaries.

**Non-Goals:** No evidence/source filesystem access from the semantic module, even when provenance resembles a valid path (existing session/configuration persistence I/O remains required); no file evidence/expansion or search registration; no semantic public library export, provider fallback, new ledger, live measurement or release claim. Plain snippets are intentional for records, not an approximation of future N#HH rendering.

## Decisions

### 1. Internal module and owner boundary

Create a small internal semantic subsystem for validation/contracts, fixed rubric and pure derived views, parent workspace/execution, and result/snippet assembly. Pi wrappers supply the fixed semantic consumer kind. Keep core free of semantic/filesystem imports and keep the public library entry/exports and discovery protocol unchanged.

Attach one semantic service to each elected owner's runtime alongside the existing coordinator. Compatible duplicate extensions still return before registration. Use the current session/epoch/generation checks for every semantic call, not a module singleton or a separately allocated scheduler. New wrappers register at session_start alongside generic tools, codemode when families.semantic is true and hidden otherwise; executing hidden submission/continuation must still fail family_disabled. Credentials and flags retain existing authorization semantics. Retrieval of retained data while processing is disabled remains allowed, as specified by the contract.

Alternative: implement filters by invoking generic tools from another tool. Rejected because it adds nested usage ambiguity and exposes child-batch concerns to callers; use the trusted coordinator directly while preserving one reporting boundary.

### 2. Exact record judgment and identity

Implement semantic-v1's one relevance choice with its three fixed labels and exact instructions/criteria from the contract. Preserve raw native answers, declared abstention, judgment IDs and provider/reuse origin. Derive match only for a raw match meeting the finite [0,1] cutoff; rejected matches and insufficient-context are unresolved, not negatives. Default cutoff remains experimental label-only zero. Do not add a score question, heuristic confidence threshold or generated explanation.

Copy and validate all records/provenance/predicate/policy before creating a parent. Enforce 1–128 unique IDs, 128-byte identifiers, 16 KiB text, 2 KiB predicate, bounded closed provenance and 1 MiB total canonical submission. Empty text is allowed. Classifier state is exactly `{predicate,evidence:{text,source:{kind:'record'}}}`. Caller IDs and provenance never enter classifier state or reusable input versions; retain them solely for deterministic attribution. Version record input by captured text hash/preparation version. Execution identity also pins ordered records and predicate/rubric/model; view identity adds revision and policy. Model configuration fingerprints are part of pinning and reuse.

Output evidence always has kind record, verification unverified and copied optional provenance. `checkCurrent:true` still returns unverified with zero file reads; it cannot upgrade provenance. Insufficient records have expansion.state none (not a pending obligation), expanded null, and remain unresolved. No file-kind output or synthetic verified location is allowed in this slice.

### 3. Parent execution and trusted budget bridge

A parent retains all original records/outcomes plus materialized child identities. Submit without run prepares pending work only. Execution creates children of at most eight records in input order, one active child per parent. Continue resumes an existing partial child before creating another; completed successes are never resubmitted. Retain child records, counters and core-owned reuse references until parent release/expiry so explicit failure retries cannot reset lifetime caps. Child IDs are private implementation details, not semantic API handles.

Retained children count against the existing 32-batch bound. A single 128-record filter may use 16 children; concurrent parents can hit the shared bound before the eight-parent limit. Report partial workspace_full without silently evicting/rebuilding children; callers may release other idle workspaces. This is a disclosed resource bound, not permission to lose results or claim complete processing. Eligible reuse is guaranteed only while the source remains retained, as in the existing core contract.

Add an internal coordinator execution result with deterministic invocation chargedRequests/chargedInputBytes, alongside the existing native Usage delta. Calculate from the current invocation's actual reservation counters; include failed/unknown-usage liability and subtract only successfully verified nondispatch releases. Return these counters on partial/error paths too, with conservative stop if unavailable. Public generic structured envelopes and public library types remain unchanged: project internal bridge strips/owns these fields before returning public results. Never derive parent allowance from session-total differences under parallel callers or from provider token counts.

Before each child run, pass only remaining parent request/byte allowance and monotonic deadline. Retries consume the same lower budget. Run time includes parent preparation/execution overhead within the executing call, queue waits and child drain; a no-run preparation is separately bounded synchronous work. Retain core's per-attempt deadlines and native maxRetries zero. Stop rather than rounding an exhausted remaining deadline into fresh time. An internal bounded child-outcome accessor avoids depending on public generic pagination for semantic aggregation and handles partial error pages without losing successful outcomes.

A parent lock prevents overlap and returns search_busy. Validate the entire explicit retry ID list against original/child mappings, failed eligibility and remaining lifetime attempts before mutation or dispatch. Core validation still applies to each selected child. Parent completion means all records are judged or failed, independent of child/page completion. Filters always have complete enumeration, zero file/exclusion counts, zero expansion counts, mode filter, null targetMatches/stopPolicy and exact outcome partitions.

Alternative: allocate one 128-record child and another parent-local semaphore. Rejected because it would discard the shared eight-item-ahead design and introduce an unnecessary concurrency domain. Alternative: release/recreate failed children to free slots. Rejected because it resets retries and hides expiry.

### 4. Shared retained-data accounting

Factor the existing retained/reserved byte counters into a coordinator-owned, consumer-neutral memory accounting primitive used by both Workspaces and the semantic store. Do not add a separate 8 MiB allowance. Keep generic's 32-batch bound and add eight semantic parents, with atomic rollback if parent admission cannot fit.

Count actual retained copies: original record text/provenance/model/metadata, parent raw outcomes, child input/answers, and retained reuse references/data according to ownership. A reference is not another serialized answer copy; a cloned answer is. Reserve bounded parent result growth before admission using the fixed semantic answer shape, actual pinned-model metadata and safe-integer field bounds, rather than multiplying the generic 64 KiB answer cap by 128 and making the documented maximum unusable. Derive and test that bound; core still validates its own 64 KiB native-answer ceiling and reserves answer growth before dispatch. Parent future-output reservation and child allocations are separate actual owners, not double grants. Child admission can still stop explicitly when shared capacity is unavailable.

Use release/transfer tokens for accounting so failed preparation, no-dispatch errors, continuation, parent release and generation clearing cannot leak or double-release reservations. Parent release clears all owned children/reuse references without touching another parent's data or financial liability. Do not silently free live parents to admit a new one. Prefer stateless authenticated revision cursors over an unbounded retained cursor registry.

### 5. Results and captured snippets

Implement record-compatible SemanticPage, ItemResult and Snippet exactly as the documented contract, with closed TypeBox inputs and outputs and runtime validation. Return all mandatory fields even for prepared/error/empty-page states. Raw answers and original IDs are preserved; every item includes a bounded plain captured snippet (20 lines/2 KiB default). Whole-line display is deliberate: a large line can yield a truncated empty default snippet and a larger bounded semantic_evidence request; at the hard maximum use explicit output_limit, never fabricated partial-line anchors. Record path/ranges are null and freshness unverified regardless of provenance/checkCurrent.

Result pages default to 20, maximum 100 items/128 KiB including metadata; return explicit output_limit if a single item cannot fit, never an endlessly nonadvancing cursor. Snippet retrieval selects 1–20 unique parent-owned evidence IDs with bounded line offsets/limits and the same envelope cap; include next offsets/truncation. No file I/O or model call in results/evidence/refiltering. Copies returned to callers must not mutate retained raw answers or policy.

Treat a results policy argument as a pure requested view, not mutation of the parent's creation policy. A cursor binds operation/epoch/generation/revision/policy/limit/offset; callers repeat the same policy with cursor (omission selects creation policy). Concurrent independent re-filtered views must not invalidate each other. Continuation changes revision, including valid no-dispatch stops; invalid requests do not change it. Old revision yields cursor_stale, wrong view/limit yields cursor_invalid, busy reads search_busy. Unknown/released/expired semantic handles yield search_expired, including filters. Do not register semantic_search or accept search/discovery fields on record input.

### 6. Lifecycle, release and fault propagation

Owner lifecycle must manage parent runs, not only native promises. Give the semantic service explicit gate/abort/drain/clear hooks under owner control. On pause/disable: close parent admission synchronously, signal parent controllers, disable core, then await parent and core drain. On successful navigation/retirement: invalidate parent generation before any late callbacks can enqueue work, drain, clear parent-owned resources and then core state. Compaction does neither. Cancelled navigation retains handles but stays disabled after the before-hook. Route the user disable command through owner pause rather than its current coordinator-only drain path.

Parent calls preserve the original runtime identity across awaits and never acquire a replacement runtime implicitly. A core storage fault stops the parent; it cannot be cleared by creating another child. Pin full model identity on every submit/continue, including between children. Re-enablement preserves charges and does not restart failed records. Extend `/decisions release` by the `sem-` namespace; reject busy parents without cancellation/refund. Do not expose a way to release owned children independently through semantic results.

Alternative: clear semantic maps only on session_start. Rejected because tree navigation and late parent callbacks would retain stale authority or leak shared memory. The generic library and external participating copies continue to use the existing owner; no semantic export is needed.

### 7. Verification and packaging

Use isolated fake providers and temporary real Pi sessions; no live calls. Unit tests cover closed parsing, boundary sizes/Unicode, exact hashes/state/rubric, mutation isolation, pure cutoff policy, raw retention and snippets. Runtime tests cover >8 records, partial child resumption, global validation of mixed retry selections, reused records under different IDs, model changes between children, parent request/input/deadline budgets under parallel generic/library work, unknown usage, failed storage and abort-ignoring providers.

Exercise all family configurations through actual Pi loader/runner/codemode, including two physical extension/library copies, one shared owner, seven registered definitions with correct exposure, hidden-path rejection, nested usage counted once and lifecycle parent-drain races. Preserve the existing 140-test suite; assertions hardcoding three tools must be updated only where the actual intended inventory changes, not deleted wholesale. Update verify-package to validate both existing generic and new semantic installed behavior, retain inert library imports and TypeScript exports, and avoid bundled peers/source leakage. Add documentation examples and map each implemented SM case to concrete assertions; filesystem/expansion/evaluation cases remain honestly outstanding.

## Risks / Trade-offs

- Retained children consume the 32-batch cap → disclose partial workspace_full and explicit parent release; do not restore handles by resubmission.
- Memory refactor may regress generic admission/reuse → preserve all generic bounds and add cross-family conservation/fault tests before semantic orchestration.
- Parent drain can race navigation/disable → synchronous parent gate plus awaited parent/core settlement and generation checks on every await boundary.
- Structurally valid semantic judgments can be wrong → label defaults experimental; Phase H gates remain unmeasured and unchanged.
- Input/result snippets may be saved in normal Pi transcripts → preserve disclosure and diagnostic/ledger redaction; do not claim transcript secrecy.

## Migration Plan

After explicit apply authorization, add pure contracts and internal resource primitives, then parent execution/views, then Pi integration, regressions and packaging/documentation. No ledger or saved configuration migration; semantic remains false by default. Enabling it requires explicit existing configuration and session authorization. Rollback is disable semantic-family execution/reload while retaining the cumulative ledger and generic controls. Synchronize the four deltas only after implementation verification and archive through the required workflow; archive action is outside the implementation checklist so no checkbox must claim an archive before it occurs.

## Open Questions

No implementation-blocking product decision is deferred. Exact helper/file naming may change without changing contracts. Model-specific semantic quality, native smoke and pilot authorization/credentials remain later explicit evaluation work, not acceptance substitutes for this slice.
