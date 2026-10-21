# Spec Delta

## Purpose

Provide one installable Pi extension and an experimental library that share a single managed execution domain across participating consumers and separate package copies.

## ADDED Requirements

### Requirement: One package with independent library imports

The toolkit SHALL ship one package with a Pi extension entry and a separately importable experimental library entry. Importing the library SHALL NOT register tools, allocate session resources, perform I/O, start timers, discover owners, or call providers. The library SHALL NOT depend on semantic filesystem-search modules.

#### Scenario: Import outside a session
- **WHEN** a consumer imports the library without constructing a Pi session
- **THEN** no registration or runtime side effect occurs and explicit connection remains available

#### Scenario: Local package consumption
- **WHEN** the built package is installed into an isolated local consumer
- **THEN** both declared entries resolve and the library exposes its public types without requiring unpublished source files

### Requirement: Explicit compatible owner discovery

Participating consumers SHALL use one explicit session owner rather than relying on npm module identity. A compatible duplicate extension entry SHALL NOT register duplicate commands/tools or create a second scheduler or allowance. Missing, incompatible, or conflicting owners SHALL fail clearly without creating a fallback execution domain. Conflicting owners SHALL stop dispatch.

#### Scenario: Separate compatible copies
- **WHEN** two physical library copies and duplicate compatible extension entries load in one Pi extension runtime
- **THEN** there is one registered toolkit owner and concurrent clients share its authorization, scheduling, and accounting

#### Scenario: Incompatible or ambiguous owner
- **WHEN** discovery finds an incompatible protocol or multiple owners
- **THEN** connection fails with coordinator_incompatible or coordinator_conflict and no independent provider work starts

#### Scenario: Owner absent
- **WHEN** a consumer explicitly connects without an owner
- **THEN** it receives coordinator_unavailable rather than a newly allocated executor

### Requirement: Structured codemode tools

The extension SHALL expose decision_submit, decision_results, and decision_continue as codemode-oriented operations with declared output schemas and matching structuredContent. Human-facing rendering SHALL NOT be the programmatic result interface. Structured failures SHALL include stable codes and use Pi error-result signaling while preserving available partial data.

#### Scenario: Script receives batch data
- **WHEN** codemode invokes a registered generic operation
- **THEN** the caller receives an ok/value or ok/error envelope without parsing rendered prose

#### Scenario: Error carries partial work
- **WHEN** execution encounters a session-level fault after some items complete
- **THEN** the error envelope preserves available completed outcomes and the tool signals an error without treating those outcomes as failed judgments

### Requirement: Single usage-reporting boundary

Every actual native attempt SHALL be charged once in toolkit accounting. Each executing wrapper SHALL report only its invocation's known native usage delta to Pi; result retrieval, reuse, and aggregation SHALL NOT re-report cumulative usage as new usage. Library consumers SHALL receive usage data and documented reporting responsibility. Unknown usage and unknown prices SHALL remain explicit.

#### Scenario: Nested tool aggregation
- **WHEN** codemode or another tool invokes a generic tool and later retrieves the same batch
- **THEN** the executing tool's delta is aggregated once by Pi and retrieval contributes no new usage

#### Scenario: Library result without a tool boundary
- **WHEN** a command-only library consumer executes work
- **THEN** it receives usage data and toolkit accounting is updated without claiming an unsupported automatic Pi footer update

### Requirement: Future semantic consumers share core execution

A semantic consumer SHALL use the same executor, model policy, cancellation, concurrency, and accounting domain as generic tools and library clients. Core batch completion SHALL NOT assert parent search completeness.

#### Scenario: Consumer has unsubmitted work
- **WHEN** a semantic test consumer finishes a batch but retains unsubmitted work or an expansion obligation
- **THEN** its parent operation remains incomplete and aggregation causes no new provider charge
