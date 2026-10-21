# Spec Delta

## MODIFIED Requirements

### Requirement: Model-independent private preparation

Filesystem preparation and freshness SHALL perform zero classifier calls and grant no execution authority. They SHALL remain internal primitives consumed only by explicitly authorized semantic operations using a trusted host root and existing shared memory, without changing generic/library interfaces, discovery protocol, disabled defaults or record provenance behavior. Registering a systematic semantic_search consumer SHALL NOT make acquisition automatic or give tools a root/exclusion bypass. No persistent evidence cache, context expansion or N#HH rendering SHALL be introduced by this preparation boundary. Routine failures SHALL use stable sanitized codes without raw source content or underlying process exception output.

#### Scenario: Capture contains hostile instructions
- **WHEN** a captured source contains instructions to read a secret or invoke a model
- **THEN** it remains inert evidence and cannot change root, exclusions, scope or provider-call count

#### Scenario: Import and record regression
- **WHEN** the public library is imported or record evidence is retrieved with an apparent file path
- **THEN** import remains inert and record retrieval still performs no source read or provenance upgrade
