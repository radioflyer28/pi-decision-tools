# Spec Delta

## MODIFIED Requirements

### Requirement: Structured codemode tools

The extension SHALL expose decision_submit, decision_results, and decision_continue as codemode-oriented operations with declared output schemas and matching structuredContent. It SHALL also register semantic_filter, semantic_results, semantic_continue and record-only semantic_evidence, exposing each family as codemode when configured and hidden otherwise while retaining execution-time enforcement. semantic_search SHALL NOT be registered by this record-filtering slice. Human-facing rendering SHALL NOT be the programmatic result interface. Structured failures SHALL include stable codes and use Pi error-result signaling while preserving available partial data.

#### Scenario: Script receives batch data
- **WHEN** codemode invokes a registered generic operation
- **THEN** the caller receives an ok/value or ok/error envelope without parsing rendered prose

#### Scenario: Error carries partial work
- **WHEN** execution encounters a session-level fault after some items complete
- **THEN** the error envelope preserves available completed outcomes and the tool signals an error without treating those outcomes as failed judgments

#### Scenario: Independent semantic registration
- **WHEN** the package loads with semantic enabled and generic disabled
- **THEN** the four record operations have codemode exposure, the three generic operations are hidden and all execution still uses one elected owner
