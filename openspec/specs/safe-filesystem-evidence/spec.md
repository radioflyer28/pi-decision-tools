# safe-filesystem-evidence Specification

## Purpose

Prepare bounded, verified working-tree file evidence with deterministic discovery, independent exclusions, exact byte identities and honest scope coverage before any model judgment.

## Requirements

### Requirement: Confined explicit scope

The system SHALL accept only copied, closed scope input containing an optional list of 1–256 unique project-relative file or directory paths, each at most 4096 UTF-8 bytes. The trusted runtime SHALL supply the root; caller records, provenance and model answers SHALL NOT supply or replace it. Absolute, drive, UNC, NUL, malformed Unicode, parent traversal and glob paths SHALL reject before evidence reads. Harmless dot/separator forms SHALL normalize deterministically. Containment and deduplication SHALL be platform-aware, preserve actual path case, and SHALL NOT conflate distinct files on case-sensitive filesystems.

#### Scenario: Invalid later scope path
- **WHEN** a scope contains an allowed file followed by a traversal or absolute path
- **THEN** the entire request fails scope_invalid before source capture or partial workspace admission

#### Scenario: Case aliases and component boundaries
- **WHEN** paths differ only by an alias on a case-insensitive filesystem or use a sibling prefix resembling the root
- **THEN** aliases cannot produce duplicate evidence and prefix similarity cannot permit root escape

### Requirement: Bounded working-tree discovery

Within Git, default discovery SHALL use the union of tracked and non-ignored untracked working-tree paths, deduplicated and ordered by normalized UTF-8 path bytes. Explicit Git scope SHALL narrow that eligible union rather than bypass ignore or exclusion policy. Deleted tracked paths SHALL be reported missing, never read from index blobs. Discovery SHALL NOT recursively enter submodules or nested repositories. Outside Git, omitted scope or any directory scope SHALL fail git_required before source capture; explicit confined regular-file lists SHALL remain supported. Unavailable or failed Git discovery SHALL NOT silently become recursive non-Git enumeration.

#### Scenario: Tracked and untracked files
- **WHEN** a temporary Git tree contains modified tracked, nonignored untracked, ignored untracked and deleted tracked files
- **THEN** capture uses current bytes of the first two, omits ignored untracked files and reports the deletion without resurrecting index content

#### Scenario: Non-Git explicit files
- **WHEN** a non-Git project receives either omitted/directory scope or an explicit confined file list
- **THEN** only the explicit-file request can capture evidence and the others return git_required without implicit traversal

#### Scenario: Nested repository boundary
- **WHEN** an eligible candidate is a submodule or lies inside a nested repository
- **THEN** it is excluded as nested_repository even if explicitly scoped

### Requirement: Independent exclusions and additive user policy

All discovered and explicit candidates SHALL pass the same exclusion policy. The policy SHALL exclude sensitive paths, dependency/generated/build paths, files larger than 1 MiB, nonregular objects, invalid UTF-8 or NUL-bearing content, and empty files. Sensitive and generated comparisons SHALL be ASCII case-insensitive exact segment/basename/prefix/suffix rules from the semantic contract; misleading segment prefixes SHALL NOT inherit an exclusion accidentally. Optional user configuration fileExclusions SHALL add at most 256 unique normalized relative file/directory paths of at most 4096 UTF-8 bytes each; it SHALL never remove built-in exclusions or authorize reads. Saving a model default SHALL preserve this setting, and invalid settings SHALL fail closed. Tools SHALL NOT override the exclusion policy.

#### Scenario: Tracked secret or generated file
- **WHEN** a sensitive or generated file is tracked or explicitly requested using misleading case
- **THEN** it remains excluded before content reading with the appropriate bounded reason

#### Scenario: User exclusion survives default save
- **WHEN** a user adds a relative directory exclusion and saves a different default model
- **THEN** the exclusion remains active without enabling processing or changing built-in rules

### Requirement: Link and reparse refusal

Before source reads, the system SHALL verify the trusted root and all intermediate/final components, canonical containment and regular-file identity. It SHALL refuse symbolic links, Windows junctions/reparse points and nonregular files without following them for source content. Platform inability to establish confinement SHALL be explicit unverifiable failure, not permission to read. Verification SHALL be repeated around capture to detect replacement. These checks SHALL NOT be represented as an operating-system sandbox against malicious concurrent local mutation.

#### Scenario: Intermediate link escapes the root
- **WHEN** an intermediate or final component is a symlink or junction pointing to an outside marker file
- **THEN** no marker bytes are captured and the path is excluded as link

#### Scenario: Unavailable platform verification
- **WHEN** the platform cannot establish whether a component is safe or regular
- **THEN** capture fails closed as unverifiable without source reading

### Requirement: Stable exact-byte capture and freshness

Capture SHALL bound reads, verify file identity and metadata before and after opening/reading, and reject observed changes rather than attaching unstable bytes to evidence. Full-file and passage hashes SHALL be SHA-256 over exact captured bytes including BOM and original newline terminators. Fatal UTF-8 decoding SHALL preserve lone CR, treat CRLF as one terminator, omit a leading BOM only in classifier/display text, and avoid a phantom line after terminal LF. A later current-source check SHALL repeat confinement/exclusion/stability checks and compare the full captured-file hash; changed, missing or unverifiable source SHALL remain explicit and SHALL NOT replace historical bytes.

#### Scenario: Capture-time replacement
- **WHEN** a file is replaced or its size or identity changes during capture
- **THEN** it yields changed or unverifiable rather than verified evidence under the earlier identity

#### Scenario: Later modification or deletion
- **WHEN** a previously captured path changes content, disappears or becomes inaccessible
- **THEN** freshness reports changed, missing or unverifiable while retained evidence still contains its original bytes and hashes

#### Scenario: Line and encoding variants
- **WHEN** inputs include BOM, Unicode, LF, CRLF, lone CR, empty content, terminal LF, invalid UTF-8 or NUL
- **THEN** valid bytes retain exact ranges/hashes and invalid or empty content is explicitly excluded without fabricated lines

### Requirement: Contiguous bounded windows

The system SHALL form language-agnostic greedy windows of at most 64 whole lines and 8192 original bytes including terminators. Consecutive windows SHALL overlap at most eight whole lines and advance by at least one line. A line exceeding 8192 bytes SHALL be an explicit line_too_large excluded range; windows SHALL NOT truncate that line, skip across it or join noncontiguous ranges. Windows SHALL retain original one-based inclusive line numbers, and no lexical or semantic relevance gate SHALL omit otherwise eligible text.

#### Scenario: Overlap at both bounds
- **WHEN** text reaches the line or byte bound with multibyte characters and mixed newline terminators
- **THEN** every emitted window respects both bounds and progresses with at most eight whole overlapping lines and exact source ranges

#### Scenario: Oversized intervening line
- **WHEN** a line larger than 8192 bytes separates two eligible regions
- **THEN** the line is counted once as excluded and no window joins the two regions

### Requirement: Immutable file evidence identity

Only permitted stable capture SHALL mint file evidence marked captured, with runtime-stable root identity, normalized actual path, original range, full file hash, passage hash and windows-v1 preparation identity. Snapshot identity SHALL cover the ordered captured path/file-hash inventory and scope/policy identity, without claiming repository-wide atomicity. Reusable passage input identity SHALL include root/path/range/full-file hash/passage hash/preparation version and exclude opaque evidence IDs and unrelated snapshot inventories. Returned data SHALL be isolated from retained evidence; no caller-supplied provenance SHALL be upgraded to captured file authority.

#### Scenario: Unrelated captured file changes
- **WHEN** a new capture adds or changes a different file while a passage's own source remains unchanged in the same runtime root
- **THEN** the snapshot may change but that passage retains its reusable input identity

#### Scenario: Same passage bytes in a changed file
- **WHEN** content elsewhere in the same file changes while a passage stays textually identical
- **THEN** the full-file hash changes its reusable input identity and historical evidence is not mutated

### Requirement: Honest bounded scope and shared memory

Enumeration SHALL be bounded to 10000 entries, capture admission to 256 files, and initial windows to 2048. Capture state, original bytes, metadata, retained copies and reserved growth SHALL share the coordinator's existing 8 MiB retained/reserved ceiling, not an independent grant. Scope/resource interruption SHALL preserve admitted evidence and report incomplete coverage with scope_limit or workspace_full and unknown remaining totals where enumeration/capture is unfinished. It SHALL NOT masquerade as a content exclusion or exhaustive no-match. Exclusion details SHALL be capped at 100, with complete observed reason totals and explicit truncation; each excluded file SHALL count once by its first applicable reason, separately from excluded ranges. Release SHALL free only owned ephemeral allocations without affecting ledger liability.

#### Scenario: Enumeration or capture bound
- **WHEN** enumeration exceeds 10000 entries, admission exceeds 256 files or window production exceeds 2048
- **THEN** bounded partial evidence and honest incomplete scope are returned without hidden narrowing or a complete-processing claim

#### Scenario: Generic memory competes with capture
- **WHEN** existing generic or record work leaves insufficient shared retained capacity
- **THEN** capture reports workspace_full without another memory pool, eviction or loss of unrelated handles

#### Scenario: Exclusion detail overflow
- **WHEN** more than 100 exclusions are observed
- **THEN** details remain bounded, truncation is explicit and reason totals still describe all observed exclusions

### Requirement: Model-independent private preparation

Filesystem preparation and freshness SHALL perform zero classifier calls and grant no execution authority. They SHALL remain internal primitives consumed only by explicitly authorized semantic operations using a trusted host root and existing shared memory, without changing generic/library interfaces, discovery protocol, disabled defaults or record provenance behavior. Registering a systematic semantic_search consumer SHALL NOT make acquisition automatic or give tools a root/exclusion bypass. No persistent evidence cache, context expansion or N#HH rendering SHALL be introduced by this preparation boundary. Routine failures SHALL use stable sanitized codes without raw source content or underlying process exception output.

#### Scenario: Capture contains hostile instructions
- **WHEN** a captured source contains instructions to read a secret or invoke a model
- **THEN** it remains inert evidence and cannot change root, exclusions, scope or provider-call count

#### Scenario: Import and record regression
- **WHEN** the public library is imported or record evidence is retrieved with an apparent file path
- **THEN** import remains inert and record retrieval still performs no source read or provenance upgrade
