# Design

## Context

See proposal.md for motivation. Current code is strict TypeScript NodeNext, with no new runtime dependency planned. SemanticExecution/Parents/Results currently assume PreparedFilter records, retained contiguous eight-item children and synchronous record evidence reads. SessionOwner creates these services without a filesystem root. Phase D supplies FileEvidenceCapturer with injected memory, captured IDs/state, scope summaries, immutable text, freshness and release. Tool schemas currently encode record-only pages and exactly seven definitions.

Inspection found an integration hazard: retaining all settled child batches makes a search hit32 live batches after256 windows even with ample memory. Another hazard is lifecycle tracking: existing run tracking starts after parent admission and does not cover asynchronous source capture/current checks. Both must be addressed in behavioral slices, not left to later hardening.

## Goals / Non-Goals

Goals: implement the new requirement set through shared semantic orchestration; preserve record/generic contracts; make capture, raw judgments and ledger liability independently observable; verify behavior and prevent regressions with appropriate tests.

Non-goals: discovery/priority/target mode, automatic expansion, hashline rendering, persistent search state, public semantic library exports, model-quality claims, live calls, new scheduler or memory pool. The existing pilot plan and its gates remain H work; deterministic tests cannot establish recall or savings. The simpler literal/frontier search baseline remains the live-evaluation comparator, not a hidden prefilter.

## Decisions

### One semantic engine with discriminated prepared evidence

Generalize parent preparation to filter/search kinds and evidence types, preserving the existing record entrypoint. Search preparation holds a separately owned CapturedScope and serializable metadata/outcomes, materializing child inputs only when needed. Count every actual retained metadata/text copy in the same pool; do not serialize class instances as if that measured private buffers. Use capture-owned bytes/offsets for file snippets so BOM/newline hashes are not reconstructed from normalized display text. Avoid implementing another scheduler or separate search continuation loop; F must reuse this path later.

### Trusted owner context and capture transaction

Lifecycle passes the host session project root and validated fileExclusions into the elected runtime's semantic service. Keep a runtime-stable capturer/root identity, reset on generation replacement. Never derive root from cwd changes by tool arguments, record provenance or classifier output. Existing owner tests without filesystem context can still use record operations; filesystem acquisition must fail closed without trusted context.

Validate the entire request and authorization before I/O. Search path-bearing input uses the full bounded path-list JSON allowance from D, not the record submission cap that would reject valid maximum lists. Reject all future-mode fields now. Pin model before capture and recheck before native dispatch. Register acquisition in lifecycle tracking before its first await; pending admissions count against the same eight-parent limit. A failed admission releases capture/metadata reservations. A retained partial capture becomes an honestly incomplete search if parent admission succeeds; inability to admit a parent fails atomically with no orphan allocation.

Run deadlines start before acquisition and decrease across capture and classification. Preparatory I/O is bounded/cancellable even without run using user work ceilings; provider work still requires persisted conversation. Capture consumes no request/input-byte units. Cancellation/disable/navigation must abort acquisition and drain workers/handles before generation cleanup. Current-source evidence reads also acquire a tracked read lease, without changing execution revision, and must drain before capture release. Results remain readable while disabled; expired generations do not admit late work.

### Child settlement and retention

Keep at most one eight-item child ahead. Retain pending or retry-eligible child state and its lifetime counters. After a child is settled and contains no eligible retry obligation, copy its final outcomes and cumulative diagnostic/usage contribution into measured parent ownership, then release the core batch. Preserve ordered child extent/retirement metadata so future preparation cannot repeat those passages. Aggregation must count retired and live child contributions once, never use cumulative usage as fresh wrapper usage, and never recreate a retired success to regain allowance. All32 slots can still legitimately be consumed by other parents/generic work or retryable children; report workspace_full rather than eviction/reset. This is preferred to raising the global batch cap or adding unbounded completed-child retention.

### Coverage, identity and views

Use capture.scopeComplete in addition to initial outcome partitions when deriving complete. Preserve capture stop reason after retained execution finishes. Retained pending work and explicit eligible retries can resume; uncaptured remainder cannot. Empty fully captured scopes are complete with zero attempts. Capture bounds/exclusions remain distinct from judgment results, and exclusions compete for the page byte cap while reason totals stay complete.

Execution identity includes scope/snapshot, systematic order, rubric, predicate, pinned model and preparation version. Cutoff changes do not alter raw answers or processing. File model state is exactly capture.item's predicate/evidence/source shape. Raw insufficient-context is unresolved; no follow-up obligation exists until G. Reuse is only eligible while the existing core retains its source; retiring child storage is not a promise of persistent cross-search caching.

Extend declared schemas with file evidence/snippet and search coverage variants; keep record output compatible. Default snippets remain plain20 lines/2KiB with original range/hash semantics and explicit truncation. checkCurrent is optional and asynchronous for owned files only; ordinary results/continuation use historical bytes without source reads. HMAC cursor authentication stays bound to parent/generation/revision/view/limit. Oversized output remains output_limit, never silent data loss.

### Verification seams and regression coverage

User explicitly confirmed **tools + runtime + host** seams: registered semantic tool envelopes; semantic execution/results public interfaces; actual Pi lifecycle/QuickJS and installed-package integration. Use real temporary Git/non-Git files and real shared coordinator/session machinery. Fake only external classifier behavior, clocks/timing where necessary, and explicit source-race boundaries. Provider request counts/payloads and ledger totals are contract side effects, not assertions about private method calls. Avoid private storage inspection and recomputing expected outputs from the implementation.

Verify implementation with meaningful behavioral tests and record commands and actual results. Test-first development and deliberate regression mutations are optional, not acceptance requirements; no red–green–red cycle is required. Preserve existing regression tests and historical evidence. Resolve discovered bugs and rerun the affected tests before acceptance. Full-suite, platform, host, package and requirement verification remain required.

## Risks / Trade-offs

- Asynchronous source work can outlive owner generation → capture/read leases tracked and drained, post-await generation checks, race tests.
- Byte accounting and conservative growth reservations may stop large scopes → count real copies, test cross-family contention and maximum windows, report explicit limits without claiming universal capacity.
- Retired children can double-count usage or lose retry history → preserve only settled nonretryable children, aggregate exactly once, test >32 children and later explicit retries.
- File snippets can hash normalized text instead of original bytes → render from capture byte ranges and use independent literal hash fixtures for BOM/CRLF/Unicode.
- Existing record/public schemas can regress → union schemas, full prior suite and actual host/family matrix, eight-tool installed-artifact verification.
- Files may contain secrets outside heuristic exclusions → preserve D policy and operator transmission consent; no claim of exhaustive secret detection or hostile-OS sandboxing.

## Migration Plan

No new configuration key or persisted ledger format. Enabling semantic family after reload exposes five semantic definitions; disabled remains default. Reload expires ephemeral handles and requires renewed execution authorization. Rollback to D removes semantic_search and file-specific result variants; no source cache migration or allowance refund. Keep existing optional fileExclusions compatible. Finalize with fresh full tests, actual platform safety regressions, offline package verification, strict OpenSpec validation, exact delta synchronization and archive. No publish step.
