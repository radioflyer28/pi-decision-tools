# semantic-record-filtering Specification

## Purpose

Filter bounded caller-supplied text records with explicit semantic judgments, captured evidence, zero-call result views and safe continuation through the toolkit's shared execution domain.

## Requirements

### Requirement: Atomic identified record admission

The system SHALL accept 1–128 uniquely identified text records and a nonempty predicate using closed JSON schemas. It SHALL copy inputs and reject malformed Unicode, unknown fields, duplicate IDs and exceeded bounds atomically. IDs SHALL be at most 128 UTF-8 bytes, text at most 16 KiB per record, predicate at most 2 KiB and the complete canonical submission at most 1 MiB. Optional provenance SHALL be limited to the documented label/path/range fields, with strings at most 512 bytes and valid paired positive line endpoints. Preparation without run SHALL make no classifier call while still requiring semantic-family and session authorization.

#### Scenario: Invalid later record
- **WHEN** a submission contains valid records followed by a duplicate ID or oversized record
- **THEN** no parent or partial child work is admitted and no provider call or reservation occurs

#### Scenario: Prepared records
- **WHEN** an authorized caller submits valid records without run
- **THEN** it receives a bounded prepared parent with pending outcomes and zero classifier attempts

### Requirement: Unverified record provenance without filesystem authority

Record evidence SHALL retain original caller attribution, captured text hash, preparation/input version and explicit unverified provenance. Caller paths, line numbers, model output and checkCurrent SHALL NOT cause evidence/source file access, verified-file attribution or context expansion. Existing session persistence/accounting I/O SHALL remain governed by the shared execution contract, not bypassed by this evidence-access restriction. Classifier state SHALL contain only predicate and evidence text with source kind record; opaque runtime IDs and caller provenance SHALL NOT affect reusable content identity. Returned structures SHALL be mutation-isolated from retained evidence.

#### Scenario: Provenance points outside the project
- **WHEN** a record claims a sensitive absolute file path and valid-looking line range
- **THEN** the result retains it only as unverified caller provenance and performs no evidence/source file read or expansion

#### Scenario: Same content under another caller ID
- **WHEN** equivalent eligible content/questions/model are submitted under another record ID in the live generation
- **THEN** reuse remains eligible without losing the new record's deterministic attribution

### Requirement: Explicit semantic judgment and cutoff policy

The system SHALL use semantic-v1's fixed relevance choice with match, no_match and insufficient_context labels, treating text as evidence rather than instructions. It SHALL preserve validated raw choice/probability/confidence answers, judgment IDs and actual pinned-model provenance. The experimental default cutoff SHALL be zero; a raw match below the selected finite [0,1] match-probability cutoff SHALL become unresolved/below_cutoff, never no-match. Raw insufficient-context SHALL remain unresolved; invalid responses and provider failures SHALL remain failures. Generic native answer semantics SHALL remain unchanged.

#### Scenario: Cutoff rejects a positive raw answer
- **WHEN** a raw match probability is below the selected cutoff
- **THEN** the raw answer remains available and the derived outcome is unresolved with below_cutoff reason

#### Scenario: Missing evidence or operational failure
- **WHEN** a record yields insufficient_context, an invalid response or a provider failure
- **THEN** those outcomes remain respectively unresolved or failed rather than being collapsed into negative matches

### Requirement: Shared bounded parent execution

A filter SHALL use the existing owner, persistence gate, scheduler, ledger, model pinning and retry policy with no second enforcement domain. A parent invocation SHALL share one decreasing request/input-byte allowance and monotonic work deadline across all child runs and retries. Deterministic charged-unit deltas SHALL include failed/unknown attempts and exclude only proven released nondispatch reservations; native usage and concurrent session-total differences SHALL NOT determine the remaining parent allowance. At most one child of eight records SHALL be submitted ahead per parent.

#### Scenario: More records than one child
- **WHEN** a ten-record filter runs with a nine-request invocation ceiling and no reuse or retries
- **THEN** no tenth invocation starts merely because a second child has begun, and remaining work is explicit

#### Scenario: Concurrent generic spending
- **WHEN** generic/library calls spend while a filter continues across children
- **THEN** the filter's lower ceilings count only its own charged attempts while all callers still share the session ceiling and concurrency pool

### Requirement: Safe parent continuation and coverage

The system SHALL preserve immutable parent execution identity, pinned model/configuration, child retry counters and successful outcomes across continuation. It SHALL resume pending work by default and validate an entire explicit failed-evidence retry selection before mutation. Parent completion SHALL mean every admitted record is judged or failed, not universal success; underlying child completion SHALL NOT cover unsubmitted records. Filter enumeration SHALL be complete at admission, file/exclusion/expansion counts zero, and coverage/outcome counts SHALL form the documented partitions.

#### Scenario: Completed first child
- **WHEN** the first eight records complete but two remain unsubmitted
- **THEN** the filter remains incomplete with two pending records and continuation does not repeat the completed eight

#### Scenario: Mixed invalid retry list
- **WHEN** explicit retry selection includes a success or unknown ID alongside an eligible failure in another child
- **THEN** the whole continuation rejects before attempts, counters or revision change

#### Scenario: Changed parent model policy
- **WHEN** the current model or configuration fingerprint differs before a later child begins
- **THEN** no mismatched child dispatch occurs and the parent reports model_policy_mismatch without fallback

### Requirement: Pure bounded result views and snippets

semantic_results SHALL retrieve record-compatible SemanticPage envelopes with all mandatory identity, policy, raw/final outcome, coverage, usage, ledger and pagination fields. Re-filtering SHALL make zero provider calls and SHALL NOT change raw answers or processing progress. Pages SHALL default to20, allow1–100 items and cap the whole envelope at128KiB. Cursors SHALL bind parent/generation/revision/view/limit; changed revisions SHALL fail cursor_stale and mismatched view/limit cursor_invalid. Busy parent reads SHALL fail search_busy. Shared operations MAY also serve captured-file search parents under their separate systematic-search contract without weakening record guarantees.

Every record result item SHALL include a bounded plain captured snippet, defaulting to20 lines/2KiB. For record parents, semantic_evidence SHALL accept1–20 unique parent-owned evidence IDs, bounded line offsets and at most100 lines/16KiB per requested snippet within the page cap, without model calls or source file reads. Record path/ranges SHALL remain null and freshness unverified, including when checkCurrent is true. Whole-line truncation, next offsets and output_limit SHALL be explicit; no partial line SHALL masquerade as complete evidence.

#### Scenario: Re-filter then page
- **WHEN** a caller selects a higher cutoff and traverses that fixed view using matching policy/limit cursors
- **THEN** only derived outcomes change, each item appears once, and no provider usage is newly reported

#### Scenario: Oversized display line
- **WHEN** a captured record's first line exceeds the selected snippet byte limit
- **THEN** output reports truncation and a bounded retrieval path or output_limit without fabricating a partial line or filesystem anchor

### Requirement: Parent cancellation and conservative expiry

Cancellation, disable and lifecycle teardown SHALL stop new parent/child dispatch, propagate abort and drain actual promises before freeing execution resources. Already-started attempts SHALL retain liability. Compaction alone SHALL preserve parents; successful navigation and runtime replacement SHALL expire them. Unknown/released/old-generation semantic handles SHALL yield search_expired without replay. The decisions release command SHALL accept idle sem-prefixed parent handles, reject busy parents with search_busy and release owned child/memory references without refunding spending.

#### Scenario: Disable during an abort-ignoring child
- **WHEN** the user disables while a parent has a running native call that has not settled
- **THEN** parent admission closes immediately, no later child starts, and drain keeps the occupied native slot until settlement

#### Scenario: Release or reopen
- **WHEN** an idle parent is released or its session is reopened
- **THEN** later semantic access returns search_expired with no resubmission, file read or allowance reset

### Requirement: Shared retained-data admission and explicit limits

At most eight semantic parents SHALL be retained, sharing the existing 8 MiB serialized retained/reserved-data ceiling with generic batches, child inputs/answers and eligible reuse. Actual copies and reserved result growth SHALL be accounted without duplicate grants or silent live-handle eviction. Child batches SHALL count toward the existing 32-batch limit. Failure to admit another child SHALL preserve available partial outcomes and report workspace_full, not reset retry counters or claim completion.

#### Scenario: Generic and semantic memory contention
- **WHEN** a parent or child would exceed the shared retained-data limit while generic work is live
- **THEN** admission fails without independently allocating another memory pool or invalidating unrelated handles

#### Scenario: Child count exhausted
- **WHEN** retained parents and generic work consume the available child-batch slots
- **THEN** the parent preserves its progress and explicitly stops until resources can be released rather than rebuilding old children

### Requirement: Structured tools and once-only usage

The record operations SHALL expose closed schemas and matching structuredContent with sanitized error envelopes and appropriate isError signaling. Their fixed semantic consumer identity SHALL enforce family permission even for hidden/internal invocation. Only the executing owning wrapper SHALL report fresh native usage; results, snippets, aggregation and cutoff views SHALL NOT re-report cumulative usage. Routine diagnostics/ledger SHALL exclude raw record text, provenance content, answers and provider exception strings, while normal transcript exposure is disclosed.

#### Scenario: Nested semantic tool and later retrieval
- **WHEN** codemode invokes a filter and then retrieves or re-filters its results
- **THEN** Pi receives the execution usage once and the subsequent data-only calls contribute no new usage

#### Scenario: Hidden semantic family
- **WHEN** semantic-family execution is disabled and its submission or continuation is called directly
- **THEN** family_disabled prevents classifier work regardless of hidden tool registration or available credentials
