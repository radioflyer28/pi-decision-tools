# Spec Delta

## MODIFIED Requirements

### Requirement: Authorized systematic search admission

semantic_search SHALL accept closed copied input with a nonempty predicate of at most2048 UTF-8 bytes, optional scope containing only paths, optional policy, optional run and optional mode systematic or discovery. Omitted mode SHALL mean systematic. Scope SHALL retain the safe-filesystem contract including full combined path bounds. Discovery SHALL follow its separate relevance-aware yielding contract; targetMatches SHALL be accepted only for discovery. Priorities, caller roots, expansion and unknown fields SHALL reject rather than silently degrade. Semantic-family and session authorization SHALL be checked before source acquisition. The trusted host SHALL provide the session project root and additive user exclusions; model answers and record provenance SHALL NOT supply either. Preparation without run SHALL capture but make zero classifier calls; execution SHALL additionally require the persisted-conversation gate.

#### Scenario: Prepare without transmission
- **WHEN** an authorized caller searches explicit eligible files without run
- **THEN** a search parent with captured evidence and pending outcomes is returned with no native attempt or ledger charge

#### Scenario: Invalid or disabled acquisition
- **WHEN** a search includes an invalid later path, a discovery-only target in systematic mode, an unsupported field, or lacks semantic authorization
- **THEN** it rejects before source reads, partial admission or provider work

### Requirement: Bounded file results and captured snippets

Shared result operations SHALL support file and record parents with closed declared output schemas. File items SHALL include captured root/snapshot/path/range/full-file/passage identities and bounded plain snippets. Systematic pages and discovery's explicit all-outcomes view SHALL include pending/failed items; discovery's qualifying-only views SHALL follow its separate contract without discarding retained outcomes. Snippet hashes SHALL describe represented original bytes before BOM removal; ranges and offsets SHALL be original and whole-line truncation explicit. Pages SHALL remain at most128KiB, default20/max100 items with revision/view/limit-bound authenticated cursors. Re-filtering and captured retrieval SHALL make zero provider calls and no new charges. Explicit checkCurrent SHALL verify only owned file evidence under capture safety policy, report unchanged/changed/missing/unverifiable and never replace historical text. Record checkCurrent SHALL remain unverified with no source read. No expansion or N#HH rendering SHALL be advertised.

#### Scenario: File pagination and cutoff view
- **WHEN** a caller traverses a fixed search revision and later changes cutoff
- **THEN** each selected item appears once in original order, old incompatible cursors reject and no raw judgment or provider usage is regenerated

#### Scenario: Changed current source
- **WHEN** an owned captured file changes and evidence is retrieved with checkCurrent
- **THEN** freshness reports changed while text/hash/ranges still describe captured bytes and no classifier is invoked
