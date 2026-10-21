# Spec Delta

## Purpose

Manage bounded identified JSON decisions with native typed answers, partial progress, explicit failures, runtime reuse, and continuation without repeating successful work.

## ADDED Requirements

### Requirement: Atomic bounded JSON submission

Submission SHALL accept identified JSON-object states, input versions, a rubric version, native choice/bool/score questions, optional explicit choice abstention labels, and optional lower run ceilings. It SHALL copy and validate all input before scheduling. Unknown structural fields, duplicate IDs, malformed JSON values, invalid Unicode, nonfinite numbers, invalid criteria, and exceeded bounds SHALL reject submission atomically. Arbitrary valid state keys SHALL remain caller data, not schema fields.

Initial bounds SHALL be 1–128 items, 1–16 questions, 2–32 choice/score criteria, identifiers/versions of 1–128 UTF-8 bytes, 64 KiB canonical state-plus-questions per item, and 1 MiB submitted canonical payload per batch. These SHALL be documented as experimental development limits.

#### Scenario: Invalid second record
- **WHEN** one record in a submission is invalid or duplicates another ID
- **THEN** no subset is submitted, no provider is invoked, and invalid_input is returned

#### Scenario: Caller changes an input object
- **WHEN** a caller mutates its original state after valid submission
- **THEN** the copied batch input and identity are unchanged

### Requirement: Immutable execution identity

Every batch SHALL pin its ordered item state and versions, question content and rubric version, abstention policy, actual model identity/configuration fingerprint, and contract version. Continuation SHALL require the expected identity and SHALL NOT modify those values. Reuse SHALL compare full eligible judgment identity, not an item ID.

#### Scenario: Changed continuation identity
- **WHEN** a caller continues with a different identity or attempts to replace questions or model
- **THEN** the request fails before mutation or dispatch

### Requirement: Native typed answers and explicit failures

Successful answers SHALL preserve choice probabilities/confidence, bool probability, and expected score index/confidence. Responses SHALL be checked for question set, type, label membership, finite ranges, choice probability keys and sum within 1e-6, model identity, and a 64 KiB answer JSON bound. Invalid answers SHALL fail explicitly and SHALL NOT be reused or interpreted as negative matches. Declared choice abstention SHALL be a completed typed answer distinct from provider failure. No universal bool/score cutoff SHALL be imposed.

#### Scenario: Valid abstention
- **WHEN** a valid choice selects a declared insufficient-evidence label
- **THEN** the item completes with its raw answer and abstained question identity rather than becoming a provider failure

#### Scenario: Wrong provider or answer shape
- **WHEN** an invocation returns a wrong model, missing question, out-of-range score, or invalid probabilities
- **THEN** it yields model_identity_mismatch or invalid_response, remains charged, and is not cached as a successful judgment

### Requirement: Partial completion and safe continuation

Item outcomes SHALL distinguish pending, running, completed, and failed. Batch completion SHALL mean all submitted items have completed or failed, not that all succeeded. Submission without a run SHALL prepare work without provider calls. Continuation SHALL resume pending work by default and SHALL NOT repeat successes. Explicit failed-item retry requests SHALL be validated atomically and retain lifetime attempt counts.

#### Scenario: One-call execution window
- **WHEN** a two-item batch runs with a one-request invocation ceiling and is then continued
- **THEN** the first run reports one completed and one pending item and continuation invokes only the pending item

#### Scenario: Complete with failures
- **WHEN** one item completed and the other failed with no pending work
- **THEN** the batch is complete with one failure, and default continuation performs no new attempt

### Requirement: Bounded same-model retry policy

Automatic retries SHALL require a failed invocation with observed structured status 408, 429, 500, 502, 503, or 504, matching pinned policy, and remaining authorization/time/allowance. The lifetime total SHALL NOT exceed one plus the user's configured maxRetries, including explicit retries. Unknown error text, authorization failure, invalid output/input, and missing model SHALL NOT trigger inferred retries or fallback. Dispatched cancellation MAY be explicitly retried within the same lifetime cap.

#### Scenario: Transient structured failure
- **WHEN** an attempt fails with observed status 429 and every retry precondition is satisfied
- **THEN** one same-model retry may run with a fresh reservation and preserved successful siblings

#### Scenario: Invalid failed-item selection
- **WHEN** retryFailedIds contains a success, duplicate, unknown, or exhausted item
- **THEN** the whole continuation request rejects before new work or outcome mutation

### Requirement: Bounded revision-aware results

Results SHALL expose immutable identity, model/rubric identity, disjoint outcome counts, stop reason, raw typed outcomes, diagnostics, cumulative usage, ledger totals, and pagination separately from processing completion. Pages SHALL default to 20 items with a caller limit of 1–100 and at most 128 KiB serialized output. Cursors SHALL be opaque and scoped to the batch, runtime generation, and revision. Retrieval during execution SHALL fail batch_busy; invalid and old-revision cursors SHALL fail explicitly.

#### Scenario: Completed but truncated page
- **WHEN** a completed batch exceeds the selected page size
- **THEN** the page remains marked complete while page.truncated and nextCursor indicate further results without new provider calls

#### Scenario: Continuation changes revision
- **WHEN** a caller uses a cursor issued before a later continuation
- **THEN** cursor_stale requires restarting pagination rather than mixing revisions

### Requirement: Ephemeral identity-safe reuse and workspaces

Eligible completed judgments including declared abstentions SHALL be reusable only within the live generation and matching full input/question/model/policy identity. Reuse SHALL consume no provider request/input allowance but SHALL still obey authorization, model, family, and persistence checks. Failures, invalid responses, in-flight work, and interrupted unknown outcomes SHALL NOT be reused. Workspaces SHALL be bounded to 32 live batches and 8 MiB retained state/answers/reuse without silent eviction of live batches.

#### Scenario: Same judgment under another item ID
- **WHEN** a new item has a different ID but the same reusable judgment identity
- **THEN** its result may identify origin reuse and the original judgment without another provider charge

#### Scenario: Workspace exhaustion
- **WHEN** a submission would exceed the live batch or memory bound
- **THEN** workspace_full rejects it without silently expiring existing handles

### Requirement: Explicit expiry without replay

Releasing an idle batch or losing its generation SHALL invalidate its handle. Unknown, released, reopened, and old-runtime batch handles SHALL fail batch_expired without reclassification. Busy release SHALL fail. Private inputs, answers, continuations, and reuse SHALL NOT be persisted as a resumable store.

#### Scenario: Old handle after restart
- **WHEN** a caller attempts to continue a prior runtime's handle
- **THEN** batch_expired requires explicit input resubmission and no provider call occurs automatically
