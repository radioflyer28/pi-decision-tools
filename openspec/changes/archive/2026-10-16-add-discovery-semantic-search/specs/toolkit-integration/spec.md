# Spec Delta

## MODIFIED Requirements

### Requirement: Structured codemode tools

The extension SHALL expose decision_submit, decision_results, and decision_continue as codemode-oriented operations with declared output schemas and matching structuredContent. It SHALL also register semantic_filter, semantic_search, semantic_results, semantic_continue and semantic_evidence for record and captured-file parents, exposing each family as codemode when configured and hidden otherwise while retaining execution-time enforcement. semantic_search SHALL support systematic and explicit discovery modes; unsupported priorities and expansion controls SHALL reject. Discovery yields and continuation SHALL be accessible through the same tools without a new owner or usage-reporting boundary. Human-facing rendering SHALL NOT be the programmatic result interface. Structured failures SHALL include stable codes and use Pi error-result signaling while preserving available partial data.

#### Scenario: Script receives batch data
- **WHEN** codemode invokes a registered generic operation
- **THEN** the caller receives an ok/value or ok/error envelope without parsing rendered prose

#### Scenario: Error carries partial work
- **WHEN** execution encounters a session-level fault after some items complete
- **THEN** the error envelope preserves available completed outcomes and the tool signals an error without treating those outcomes as failed judgments

#### Scenario: Independent semantic registration
- **WHEN** the package loads with semantic enabled and generic disabled
- **THEN** the five semantic operations have codemode exposure, the three generic operations are hidden and all execution still uses one elected owner

#### Scenario: Search through actual codemode
- **WHEN** a nested script executes search and subsequently retrieves results/evidence
- **THEN** declared schemas match structured data, fresh native usage is reported once by the execution boundary and data-only calls add no usage

#### Scenario: Discovery continuation through installed tools
- **WHEN** an offline installed package executes discovery and a nested script continues it after a relevance yield
- **THEN** new qualifying evidence and exact incremental native usage are returned, previous successes are not repeated, and separate package copies and family settings retain one enforcement domain
