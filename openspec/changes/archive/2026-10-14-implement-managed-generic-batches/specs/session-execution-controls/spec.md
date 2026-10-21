# Spec Delta

## Purpose

Control when toolkit evidence may be transmitted, which classifier identity is used, and how session lifecycle changes invalidate execution authority and ephemeral state.

## ADDED Requirements

### Requirement: Explicit disabled-by-default authorization

Toolkit processing SHALL begin disabled. Credentials, saved defaults, configuration, tool visibility, and model judgments SHALL NOT grant authorization. Submission and execution SHALL check authorization at execution time for generic tools, semantic consumers, and participating library calls. Disabling SHALL stop new dispatch and abort/drain started attempts without refunding them merely because they were cancelled.

#### Scenario: Disabled paths
- **WHEN** a disabled session receives generic, codemode, or library submission
- **THEN** the operation returns disabled and invokes no classifier

#### Scenario: Disable with active work
- **WHEN** the user disables processing with one dispatched item and another pending item
- **THEN** started work is signaled to abort and retains its liability while pending work remains unattempted

### Requirement: User controls and atomic defaults

The toolkit SHALL provide status, enable, disable, model selection, explicit default saving, explicit replenishment, and idle-batch release through the decisions command. Interactive enablement SHALL show the selected model, transmission warning, and ceilings before confirmation. Saving a default SHALL use validated atomic replacement and SHALL NOT enable processing. Invalid configuration SHALL fail closed.

#### Scenario: Default write failure
- **WHEN** saving a validated default fails
- **THEN** the error is visible, the previous saved configuration remains intact, and authorization is unchanged

#### Scenario: Replenishment is not re-enablement
- **WHEN** an exhausted session is disabled and re-enabled
- **THEN** its remaining allowance is unchanged until an explicit additive replenishment is accepted

### Requirement: Deterministic model resolution and pinning

Explicit available provider/model identity SHALL take precedence; otherwise resolve a valid saved default, the sole available classifier, or a user picker for multiple available models. Noninteractive ambiguity SHALL fail. Explicitly unavailable models SHALL NOT fall back. Each batch SHALL pin provider/model and configuration identity; selection changes SHALL NOT migrate it. Already-dispatched work SHALL settle under its original identity.

#### Scenario: Ambiguous availability
- **WHEN** multiple credentialed classifiers exist without a valid explicit/default selection
- **THEN** interactive use requires a picker and noninteractive use returns model_ambiguous without classifying

#### Scenario: Model switch during a batch
- **WHEN** selection changes while a batch retains pending work
- **THEN** new dispatch for the mismatched batch stops with model_policy_mismatch until the pinned policy is selected again

### Requirement: Explicit bounded startup opt-in

Noninteractive startup SHALL require an explicit enable flag, an available exact model, and all required budget fields. Startup opt-in SHALL be consumed only for the initial startup epoch, not reapplied on runtime reload or replacement. Existing saved-session allowance SHALL NOT be replenished or enlarged by startup flags; lower valid limits MAY further constrain that epoch.

#### Scenario: Startup followed by reload
- **WHEN** an explicitly opted-in startup is followed by extension reload
- **THEN** the replacement runtime is disabled and the previous allowance is retained

#### Scenario: Attempted limit increase
- **WHEN** startup or agent input asks to raise an existing session's user ceilings
- **THEN** it returns limit_exceeds_user without a grant or provider call

### Requirement: Independent tool-family enforcement

Generic and semantic family settings SHALL govern execution as well as exposure. Disabled family paths SHALL fail family_disabled even when invoked internally. Explicit external library consumers SHALL remain independent of family visibility while obeying all shared session controls. Generic wrappers SHALL NOT impersonate library consumers to bypass their family gate.

#### Scenario: Hidden or disabled generic family
- **WHEN** generic processing is disabled but its operation is invoked programmatically
- **THEN** the generic path makes no provider call regardless of model-facing visibility

### Requirement: Conservative lifecycle invalidation

Successful tree navigation SHALL disable execution and expire current-generation handles and reuse without rewinding the ledger. Cancelled navigation MAY retain handles but SHALL NOT silently restore authorization revoked before navigation. Reload, reopen, shutdown, fork, clone, new session, and session switching SHALL invalidate old execution facades; replacement runtimes SHALL start disabled with no transferred mutable progress. Compaction alone SHALL preserve live-generation workspaces and accounting.

#### Scenario: Reopen or reload
- **WHEN** a saved session is reopened or its extensions reloaded
- **THEN** old handles return batch_expired, old facades return runtime_expired, and execution requires fresh authorization

#### Scenario: Forked history
- **WHEN** a new session inherits transcript entries from a parent
- **THEN** parent authorization, handles, and grant events do not become active state in the new session

#### Scenario: Compaction
- **WHEN** the current session is compacted without replacement
- **THEN** live batches remain accessible and cumulative charges remain unchanged
