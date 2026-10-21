# Spec Delta

## MODIFIED Requirements

### Requirement: Ephemeral identity-safe reuse and workspaces

Eligible completed judgments including declared abstentions SHALL be reusable only within the live generation and matching full input/question/model/policy identity. Reuse SHALL consume no provider request/input allowance but SHALL still obey authorization, model, family, and persistence checks. Failures, invalid responses, in-flight work, and interrupted unknown outcomes SHALL NOT be reused. Workspaces SHALL be bounded to 32 live batches and one shared 8 MiB serialized retained/reserved-data ceiling covering generic state/answers/reuse and semantic parent/child evidence/results without silent eviction of live batches or parents. Retained copies and reserved growth SHALL consume that same ceiling rather than per-consumer allowances.

#### Scenario: Same judgment under another item ID
- **WHEN** a new item has a different ID but the same reusable judgment identity
- **THEN** its result may identify origin reuse and the original judgment without another provider charge

#### Scenario: Workspace exhaustion
- **WHEN** a submission would exceed the live batch or memory bound
- **THEN** workspace_full rejects it without silently expiring existing handles

#### Scenario: Semantic parent competes for memory
- **WHEN** a generic submission cannot fit because retained semantic parent data occupies the shared ceiling
- **THEN** it reports workspace_full without a second allocation pool or loss of semantic progress
