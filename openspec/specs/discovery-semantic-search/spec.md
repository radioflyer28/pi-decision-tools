# Discovery Semantic Search Specification

## Purpose

Find qualifying starting evidence in bounded relevance-aware increments over safely captured source, returning control to the main LLM with honest coverage and explicit continuation through the shared execution domain.

## Requirements

### Requirement: Explicit discovery admission and fixed relevance policy

semantic_search SHALL accept explicit mode discovery with optional targetMatches integer1–100 default5, using the same trusted root/exclusions, safe capture, semantic-v1 rubric and deterministic path/range order as systematic search. Omitted mode SHALL remain systematic. Targets SHALL reject for systematic/filter parents; priorities, caller roots, expansion and unknown fields SHALL reject. Authorization SHALL precede acquisition and persistence SHALL precede native dispatch. Preparation without run SHALL transmit nothing. Qualifying evidence SHALL be a completed match meeting the immutable creation policy; default policy SHALL remain version1/minMatchProbability0, without a calibrated-confidence claim. No automatic threshold relaxation or lexical prefilter SHALL occur.

#### Scenario: Explicit opt-in without dispatch
- **WHEN** an enabled caller prepares discovery without run
- **THEN** captured pending evidence is owned, mode/target/stopPolicy are explicit, and no classifier attempt or charge occurs

#### Scenario: Invalid or unauthorized preparation
- **WHEN** a target is out of bounds, is supplied for systematic search, or semantic authorization is absent
- **THEN** the request rejects before source acquisition or partial admission

#### Scenario: Below-cutoff and unknown evidence
- **WHEN** native answers include below-cutoff matches, no_match, insufficient_context or failures
- **THEN** none counts toward the qualifying target and their raw outcomes remain separately inspectable

### Requirement: Relevance-aware bounded yielding

An executing discovery call SHALL scan until its additional qualifying-evidence target, eligible scope exhaustion or an execution constraint. Internal batch completion and runs of irrelevant/declining-relevance passages SHALL NOT cause a relevance yield. At most eight passage judgments SHALL be scheduled ahead of a yield decision; already-started work SHALL drain and retain all outcomes/usage, including qualifying overshoot. target_reached SHALL mean an increment yielded with retained work, not exhaustive search or answer sufficiency. Cancellation/deadline/authorization/model/storage/budget constraints SHALL not be hidden by a coincident target. Fully processed scope SHALL use complete; exhausted retained work from limited capture SHALL expose its acquisition limit. Forced handoffs MAY contain few/no qualifying hits and SHALL NOT pad them with weak evidence.

#### Scenario: Dense target with bounded overshoot
- **WHEN** a target of five is met within a child of eight qualifying passages and more scope remains
- **THEN** the call yields after that child with all eight outcomes and charges preserved, explicit target_reached, incomplete coverage and no next-child dispatch

#### Scenario: Relevant evidence after irrelevant children
- **WHEN** early children contain only negative or unresolved judgments and a later child has qualifying evidence within budget
- **THEN** discovery continues across those children without an LLM handoff or a declining-relevance stop

#### Scenario: Empty or forced partial handoff
- **WHEN** scope or an execution limit ends the call before the target is met
- **THEN** only qualifying hits appear as hits, their count may be zero, and the actual stop reason and unknown/unexamined work remain explicit

### Requirement: Additional-evidence continuation and immutable scope

Every accepted executing discovery call SHALL target additional qualifying evidence, counting distinct newly completed evidence IDs including eligible reuse/retry completions, never prior successes. Overlapping windows SHALL remain distinct IDs and SHALL NOT be represented as diverse independent findings. A continuation's optional targetMatches SHALL replace the per-call target within1–100; omission SHALL retain the latest target and progress without cumulative-target arithmetic. All target/identity/retry validation SHALL precede revision or increment mutation. Continuation SHALL preserve captured inputs, creation stop-policy and pinned model, resume eligible retained work without repeating success, and never recapture. Query/directory changes SHALL require a new search. Valid zero-dispatch calls SHALL expose an empty new increment while prior findings remain retrievable. Retry selections stopped early SHALL retain their existing eligibility/lifetime limits without automatic replay.

#### Scenario: Ordinary continue after a yield
- **WHEN** a caller continues discovery with matching identity and no new target
- **THEN** it seeks another increment under the retained target, does not count/rejudge previous successes, and consumes only remaining shared allowance

#### Scenario: Invalid continuation is atomic
- **WHEN** a continuation combines a valid target change with an invalid mixed retry set or wrong identity
- **THEN** target, latest-increment data, revision, source reads and charges remain unchanged

#### Scenario: Changed source or new directory
- **WHEN** source changes after a yield or the LLM wants another directory
- **THEN** continuation still uses frozen evidence while searching another directory requires a separate authorized search with no allowance reset

### Requirement: Useful discovery views without evidence loss

Discovery pages SHALL default to view new_matches, returning only newly completed qualifying evidence from the latest accepted execution under the selected view policy. Explicit view matches SHALL expose cumulative qualifying evidence and view all SHALL expose every raw outcome including negative, unresolved, pending and failed items. View selectors SHALL reject for systematic/filter parents, whose existing all-outcome behavior and shapes remain unchanged. Every discovery view SHALL retain full coverage/outcome partitions, model/policy identity, targetMatches, immutable stopPolicy, yieldProgress.matched under stopPolicy, usage, diagnostics and ledger. Re-filtering SHALL change neither stopPolicy nor execution progress. Weak evidence SHALL never fill spare page capacity. Prior findings SHALL remain accessible after later or zero-dispatch calls.

#### Scenario: New increment avoids repeating old hits
- **WHEN** a second discovery execution completes new qualifying passages
- **THEN** its default page contains only that execution's qualifying evidence, while matches and all expose retained earlier evidence without provider calls

#### Scenario: View cutoff differs from stopping policy
- **WHEN** results are re-filtered using a stricter or looser view cutoff
- **THEN** only view membership/outcome derivation changes, stopPolicy and yieldProgress remain based on creation policy, and no new search work or spending occurs

#### Scenario: Failure inspection
- **WHEN** a default discovery page has no hits but coverage reports failures or unresolved judgments
- **THEN** view all exposes their retained raw details and bounded captured snippets without relabeling them as hits or negatives

### Requirement: Bounded paging and shared resource lifecycle

Discovery SHALL reuse existing parent/capture ownership, eight-parent/32-live-batch/8MiB shared bounds, scheduler, retry rules, persistence and cumulative accounting. Increment metadata and retained copies SHALL be accounted in the same pool. Pages SHALL retain the128KiB cap and default20/max100 items with authenticated parent/revision/policy/view/limit-bound cursors. Filtered fixed-revision traversal SHALL have no duplicate/missing selected items or empty intermediary pages caused only by skipped nonmatches. Capture, evidence checks and abort-ignoring dispatch SHALL drain before release/expiry; disabled historical reads remain available. Compaction SHALL preserve progress; navigation/reload/release SHALL not refund charges or silently replay. Long scans SHALL retain existing settled-child retirement without losing eligible retries or outcomes.

#### Scenario: Filtered cursor isolation
- **WHEN** a caller changes discovery view, cutoff or page size using an old cursor, or continues to a new revision
- **THEN** the cursor rejects with the appropriate invalid/stale code and restarted fixed-revision traversal returns each selected item once without calls

#### Scenario: Concurrent work and teardown
- **WHEN** discovery competes with generic/record work and is disabled or navigated away while provider work ignores abort
- **THEN** shared concurrency/allowance remain bounded, teardown waits for actual drain, and known/unknown dispatched liability is preserved

#### Scenario: Long scan and resource release
- **WHEN** discovery crosses more than32 settled children within capacity or its idle parent is released
- **THEN** completed child storage can retire with outcomes retained, while release frees owned memory without evicting unrelated work or refunding spending

### Requirement: Evidence-bounded evaluation and documentation

Verification SHALL compare discovery and E using equivalent actual captured inputs and scripted dense/sparse/late/absent/overlapping and failure outcomes, reporting qualifying/unique-span findings per handoff, attempt/input units, returned evidence volume, handoff count and observed elapsed time. Synthetic controller turns SHALL be labeled proxies, not measured LLM turns or quality. Unknown usage/pricing SHALL remain unknown. Documentation SHALL define the separately authorized paired live comparison of actual LLM turns, total decision-plus-LLM cost/context, latency and task success under existing pilot gates. It SHALL disclose experimental defaults, overlapping-ID counting, non-top-k/non-sufficiency semantics and absence of measured100x savings. Runtime/host/package verification SHALL NOT be represented as semantic-quality or release-evaluation success.

#### Scenario: Offline comparison report
- **WHEN** controlled fixture comparisons finish
- **THEN** measured operational counts are reproducible, synthetic assumptions and unknown live metrics are explicit, and no provider spending or semantic-quality claim occurs

#### Scenario: Unmeasured live benefit
- **WHEN** no authorized real-model paired experiment has run
- **THEN** docs retain H's live gates and explain the measurement procedure without marking cost, latency or task-success improvement as proven
