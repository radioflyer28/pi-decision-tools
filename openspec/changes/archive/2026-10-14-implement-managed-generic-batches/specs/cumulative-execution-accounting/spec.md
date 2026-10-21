# Spec Delta

## Purpose

Bound shared classifier work with persistent cumulative allowance and conservative reservation recovery without persisting evidence, results, or resumable batch workspaces.

## ADDED Requirements

### Requirement: Persisted-conversation execution gate

Before granting an initial allowance or dispatching provider work, the toolkit SHALL verify a readable persisted session file, matching session header identity, and an existing persisted user or assistant message. Early setup MAY be enabled without executing. Nonpersistent and pre-conversation execution SHALL fail persistence_required without creating artificial messages, frontier calls, or another journal.

#### Scenario: Custom-only new session
- **WHEN** an enabled library consumer requests execution before a real conversation is persisted
- **THEN** no provider call or reservation occurs and persistence_required explains the missing precondition

#### Scenario: Nonpersistent session
- **WHEN** execution is requested in a no-session runtime
- **THEN** it is rejected even when credentials, selection, and startup opt-in are otherwise valid

### Requirement: Durable reservation before dispatch

Every native invocation SHALL have a unique verified persisted reservation charging one request and the UTF-8 bytes of canonical state plus questions before dispatch. A successful in-memory append alone SHALL NOT authorize dispatch. Settling SHALL record known usage or explicit unknown usage without refunding logical request/input charges. Release SHALL require proof from the active runtime that invocation never began.

#### Scenario: Crash after reservation
- **WHEN** a runtime exits after reserving and before recording settlement
- **THEN** reopening retains the full request/input liability without automatically retrying or refunding it

#### Scenario: Proven non-dispatch
- **WHEN** cancellation closes a gate after reservation but before invocation and a release is successfully persisted
- **THEN** only that reservation is refunded and the item remains unattempted

#### Scenario: Memory-only append
- **WHEN** the append operation appears to succeed but read-back cannot verify the reservation on disk
- **THEN** no native invocation occurs and storage_error latches execution closed

### Requirement: All-branch cumulative replay

The ledger SHALL replay matching-session events across all branches in append order, not only the active branch. There SHALL be at most one initial grant per saved session. Re-enabling, reopening, compaction, configuration changes, or branch navigation SHALL NOT reset allowance. Only explicit additive replenishment SHALL enlarge it. Inherited foreign-session events SHALL NOT act as active grants or charges.

#### Scenario: Older branch navigation
- **WHEN** spending on branch X is followed by navigation to an earlier entry and spending on branch Y
- **THEN** subsequent replay accounts for both X and Y and cannot recreate the original allowance

#### Scenario: Explicit addition
- **WHEN** a user replenishes an exhausted ledger by two requests and two hundred input bytes
- **THEN** remaining allowance increases by exactly those amounts without erasing prior charges or enabling execution

### Requirement: Corrupt storage fails closed

Unknown current-session ledger versions, invalid sequences or transitions, duplicate event/attempt identity, overflow, negative accounting, missing initialized storage, append failures, and failed read-back SHALL stop dispatch and latch a storage fault. Re-enabling alone SHALL NOT clear the fault. Unknown liabilities SHALL NOT be assumed free.

#### Scenario: Invalid ledger replay
- **WHEN** a current-session ledger contains duplicate attempt identifiers or an unsupported version
- **THEN** the toolkit reports storage_error without treating the ledger as empty or allocating a new grant

### Requirement: Shared concurrency and bounded requests

Generic batches, semantic consumers, and participating library calls SHALL share user request/input ceilings and one concurrency pool. Agents MAY lower but SHALL NOT raise ceilings. Each retry SHALL consume fresh allowance. Queued work SHALL be scheduled fairly between batches without enqueuing an unbounded body of work. A batch SHALL reject overlapping execution with batch_busy.

#### Scenario: Parallel shared ceiling
- **WHEN** several consumers request work with concurrency two and three remaining requests
- **THEN** no more than two native calls run concurrently and no more than three calls start without replenishment or eligible reuse

#### Scenario: Item does not fit
- **WHEN** the next item cannot fit session or invocation allowance
- **THEN** it remains pending with an explicit budget_exhausted or call_limit stop reason and no reservation beyond the ceiling

### Requirement: Honest cancellation and logical units

Request limits SHALL count native classifier invocations rather than claim knowledge of provider-internal HTTP traffic. Native retries SHALL be disabled where the API supports doing so. Scheduling and attempt deadlines SHALL request cancellation and stop new dispatch, but slots SHALL remain occupied until promises settle. Actual elapsed time and cooperative-cancellation overrun SHALL be reported honestly.

#### Scenario: Provider does not settle immediately on abort
- **WHEN** a deadline is reached while a native call remains unsettled
- **THEN** no replacement uses its occupied slot and reported elapsed time includes the actual drain time

### Requirement: Private and truthful accounting diagnostics

Ledger entries and routine toolkit diagnostics SHALL exclude source text, input state, rubric text, answer maps, and unsanitized provider error strings. They SHALL expose stable failure codes, deterministic charges, known usage, unknown usage, and pricing uncertainty. Toolkit privacy claims SHALL distinguish its private state from ordinary Pi transcript persistence.

#### Scenario: Unknown pricing and sensitive failure
- **WHEN** a provider returns a failure containing source text or usage without known pricing
- **THEN** routine output is sanitized, pricing remains unknown, and the invocation still consumes its deterministic allowance
