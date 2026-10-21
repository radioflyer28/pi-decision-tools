# Tasks

## 1. Contracts and pure semantic behavior

- [x] 1.1 Add closed record/policy/operation and record-result schemas matching the Phase B contract; verify tests for unknown fields, Unicode, duplicate IDs, paired provenance ranges and every byte/count boundary with atomic rejection.
- [x] 1.2 Implement semantic-v1 rubric, canonical record state/content versions and immutable parent/view identities; verify exact transmitted state excludes caller provenance/opaque IDs and distinct caller IDs remain eligible for identical-content reuse.
- [x] 1.3 Implement pure raw-to-derived outcomes and bounded plain snippets; verify cutoff boundaries, insufficient-context/failure distinctions, mutation isolation, empty/CRLF/Unicode/long-line text and zero filesystem/model calls.

## 2. Shared execution resources

- [x] 2.1 Factor coordinator-owned retained/reserved memory accounting for generic and parent owners without semantic imports in core; verify existing workspace tests plus cross-owner conservation, rollback, shared 8 MiB admission and no silent eviction.
- [x] 2.2 Add trusted internal per-invocation charged request/input-byte results on successful, partial and failed child execution; verify retries, unknown usage, persisted nondispatch releases and storage failures, while public generic/library envelopes and types remain unchanged.
- [x] 2.3 Implement bounded semantic parent admission, result-growth reservations and child ownership/release; verify eight-parent/32-batch limits, maximum valid record admission under adequate capacity, actual-copy accounting and partial workspace_full without retry reset.

## 3. Parent execution and result operations

- [x] 3.1 Implement preparation and at-most-eight-item child sequencing with immutable model pinning and one decreasing parent deadline/request/byte budget; verify >8 records and concurrent generic/library work cannot reset lower ceilings between children.
- [x] 3.2 Implement parent locks, pending continuation and globally atomic explicit failure-retry selection; verify completed-child/incomplete-parent counts, preserved successes, lifetime caps and mixed invalid retry IDs across children.
- [x] 3.3 Implement record-compatible SemanticPage assembly, raw answer retention, zero-call cutoff views and revision/view-bound pagination; verify full output schemas, all count partitions, stale/invalid cursors, parallel views and whole-envelope byte limits.
- [x] 3.4 Implement semantic_evidence for captured records only, including checkCurrent remaining unverified; verify selected-ID/offset/size bounds, truncation, explicit output_limit and zero filesystem reads with hostile caller provenance.

## 4. Pi ownership and lifecycle

- [x] 4.1 Attach one semantic service to the elected runtime and add parent gate/abort/drain/clear sequencing; verify disable, cancelled/successful tree navigation, reload/fork/switch/reopen/shutdown and compaction including late child settlement races.
- [x] 4.2 Register the four semantic tool definitions with independent codemode/hidden exposure and matching structured results; verify disabled/family-disabled/pre-persistence/no-session paths make zero calls, generic tool names/schemas remain compatible and semantic_search is absent.
- [x] 4.3 Route semantic idle release and user disable through owner-aware handling; verify sem-handle release clears only owned resources, busy release fails, expired handles never replay and cumulative charges remain unchanged.
- [x] 4.4 Verify actual Pi loader/runner/codemode paths with fake classifiers, all family combinations and separate physical package/library copies; assert one owner/concurrency/allowance domain and invocation-only usage exactly once, including unknown usage and retrieval.

## 5. Regression, documentation and local packaging

- [x] 5.1 Map implemented SM-01–15/32–34 clauses to concrete tests, explicitly marking file/search/expansion-specific clauses as later phases rather than passed; verify adversarial evidence, sanitized diagnostics/ledger and unchanged generic choice/bool/score regressions.
- [x] 5.2 Update usage/configuration/limitations/examples and durable goal progress to distinguish available record filtering from future search/expansion and unmeasured quality; verify local links and schema-valid JSON examples, including zero-call re-filtering and partial continuation.
- [x] 5.3 Update installed-artifact verification for seven correctly exposed definitions and record filtering, preserving inert public library/type exports and unbundled peers; run typecheck, full isolated tests and offline verify:package with no live calls or publication, and record actual results.
- [x] 5.4 Reconcile implementation against all four deltas and the Phase B handoff, run strict OpenSpec validation, and document any remaining evaluation gates; verify every implementation task before requesting spec synchronization/archive as the separate final workflow action.
