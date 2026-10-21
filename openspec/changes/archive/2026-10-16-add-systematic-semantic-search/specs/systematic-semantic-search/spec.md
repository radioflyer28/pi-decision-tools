# Spec Delta

## Purpose

Evaluate safely captured working-tree passages systematically through shared authorized semantic execution, preserving bounded evidence, honest coverage and resumable progress independently of child batches.

## ADDED Requirements

### Requirement: Authorized systematic search admission

semantic_search SHALL accept closed copied input with a nonempty predicate of at most2048 UTF-8 bytes, optional scope containing only paths, optional policy, optional run and optional mode systematic. Omitted mode SHALL mean systematic. Scope SHALL retain the safe-filesystem contract including full combined path bounds. Discovery mode, priorities, targets, caller roots and unknown fields SHALL reject rather than silently degrade. Semantic-family and session authorization SHALL be checked before source acquisition. The trusted host SHALL provide the session project root and additive user exclusions; model answers and record provenance SHALL NOT supply either. Preparation without run SHALL capture but make zero classifier calls; execution SHALL additionally require the persisted-conversation gate.

#### Scenario: Prepare without transmission
- **WHEN** an authorized caller searches explicit eligible files without run
- **THEN** a search parent with captured evidence and pending outcomes is returned with no native attempt or ledger charge

#### Scenario: Invalid or disabled acquisition
- **WHEN** a search includes an invalid later path, a discovery-only field, or lacks semantic authorization
- **THEN** it rejects before source reads, partial admission or provider work

### Requirement: Systematic passage execution without relevance prefilters

Systematic search SHALL evaluate every eligible captured passage in normalized UTF-8 path order then original range order unless an explicit resource, budget, cancellation, safety or execution interruption stops it. No lexical overlap test, hidden relevance gate or target-match early stop SHALL remove work. It SHALL use semantic-v1 and exact predicate/evidence/text/source state, preserve raw outcomes and derive cutoff views without reruns. Explicit insufficient context SHALL remain unresolved with no expansion in this phase; failures SHALL never become negatives.

#### Scenario: Misleading vocabulary
- **WHEN** eligible windows include no predicate vocabulary, misleading comments and explicit insufficient context
- **THEN** all windows are submitted in deterministic order absent an explicit limit and each retains its actual raw outcome or failure

#### Scenario: More than one batch
- **WHEN** eight of ten passages finish under an eight-request invocation allowance
- **THEN** the search remains incomplete with two pending passages and does not dispatch a ninth request

### Requirement: Shared invocation budgets and pinned policy

Search SHALL use the existing owner, native scheduler, persistence gate, cumulative ledger, immutable model fingerprint and retry policy. Each invocation SHALL have one decreasing request/input-byte allowance and monotonic work deadline across acquisition and all children; capture SHALL consume time but no classifier units. At most one child of eight passages SHALL be submitted ahead. Charged-unit deltas SHALL exclude concurrent callers and include failed/unknown attempts. Unknown accounting SHALL stop conservatively. Selection/configuration changes SHALL stop mismatched dispatch without fallback; already-started calls SHALL settle under their original identity.

#### Scenario: Concurrent generic spending
- **WHEN** a search crosses child boundaries while a generic caller spends concurrently
- **THEN** its own lower invocation ceiling is neither replenished nor calculated from unrelated ledger differences and session ceilings remain shared

#### Scenario: Policy changes between children
- **WHEN** selected model configuration changes after a settled child
- **THEN** subsequent dispatch stops with model_policy_mismatch and prior outcomes/charges remain intact

### Requirement: Owned continuation and stable evidence

Search execution identity SHALL include pinned model, predicate/rubric, preparation version, systematic ordering and captured scope/snapshot, excluding view cutoff and opaque IDs. Continuation SHALL use retained evidence without rescanning or replacing changed source. It SHALL resume pending work without repeating successes and validate the complete explicit retry selection before revision, mutation or dispatch. Retries SHALL preserve lifetime attempt ceilings and frozen inputs. Stale, released or old-generation handles SHALL fail search_expired; identity mismatch SHALL not create new work.

#### Scenario: Source changes between calls
- **WHEN** files change after a partial search and the caller continues the retained operation
- **THEN** pending classifier inputs still describe the original captured bytes and no source recapture or success repetition occurs

#### Scenario: Invalid mixed retry selection
- **WHEN** selected retry IDs mix an eligible failure with a success, unknown ID or exhausted failure
- **THEN** the entire continuation rejects before revision or charges change

### Requirement: Honest scope and processing coverage

Search pages SHALL report captured/excluded files, exclusion ranges and reason totals, bounded details/truncation, enumeration completeness and known or unknown remaining candidates, and initial judged/failed/pending/running partitions. Complete SHALL require completed capture scope and every initial passage judged or failed; unresolved judgments and failures SHALL not alone imply incomplete processing. Completed children or output pages SHALL NOT imply complete searches. Scope_limit and workspace_full SHALL remain explicit incomplete scope, never exhaustive no-match. Retained pending/retry work SHALL remain resumable when possible; exhausted retained work with unfinished acquisition SHALL require a narrower new search rather than an implicit rescan. Fully enumerated zero-window scopes SHALL produce complete schema-valid zero-partition pages.

#### Scenario: Limited capture with settled retained windows
- **WHEN** capture stops at a hard scope bound and all retained windows later settle
- **THEN** the page remains incomplete, reports the acquisition limit and does not promise continuation of uncaptured work

#### Scenario: Empty eligible scope
- **WHEN** a complete Git scope has no eligible windows
- **THEN** the page includes complete coverage, observed exclusions and all required zero counts without classifier work

### Requirement: Bounded file results and captured snippets

Shared result operations SHALL support file and record parents with closed declared output schemas. File items SHALL include captured root/snapshot/path/range/full-file/passage identities and bounded plain snippets, including pending/failed items. Snippet hashes SHALL describe represented original bytes before BOM removal; ranges and offsets SHALL be original and whole-line truncation explicit. Pages SHALL remain at most128KiB, default20/max100 items with revision/view/limit-bound authenticated cursors. Re-filtering and captured retrieval SHALL make zero provider calls and no new charges. Explicit checkCurrent SHALL verify only owned file evidence under capture safety policy, report unchanged/changed/missing/unverifiable and never replace historical text. Record checkCurrent SHALL remain unverified with no source read. No expansion or N#HH rendering SHALL be advertised.

#### Scenario: File pagination and cutoff view
- **WHEN** a caller traverses a fixed search revision and later changes cutoff
- **THEN** each item appears once in original order, old incompatible cursors reject and no raw judgment or provider usage is regenerated

#### Scenario: Changed current source
- **WHEN** an owned captured file changes and evidence is retrieved with checkCurrent
- **THEN** freshness reports changed while text/hash/ranges still describe captured bytes and no classifier is invoked

### Requirement: Shared resource ownership and long searches

Search capture, parent metadata, actual retained copies, reserved growth, child inputs/outcomes and generic/record work SHALL share the existing8MiB pool, eight semantic-parent limit and32 live-batch limit. Admission failures SHALL release only newly owned resources with no eviction or liability refund. Settled nonretryable child storage MAY be released after preserving outcomes/usage; successful searches fitting other limits SHALL NOT become permanently limited to256 passages solely by retaining completed child batches. Eligible retries SHALL not be lost or reset when resources retire. Partial capture resources SHALL remain owned until parent release/expiry, and resource stops SHALL be explicit.

#### Scenario: Successful search beyond32 children
- **WHEN** more than256 eligible passages fit the shared memory bound and the caller provides sufficient allowance across continuations
- **THEN** every passage can settle without repeating earlier work or exceeding32 live batches and all judgments/usage remain inspectable

#### Scenario: Admission competes with other families
- **WHEN** generic work or record parents exhaust shared capacity during search preparation or child admission
- **THEN** workspace_full is explicit, acquired resources roll back or remain in an owned partial parent, and unrelated handles/charges remain unchanged

### Requirement: Lifecycle-safe acquisition and evidence reads

Cancellation, disable, successful navigation and runtime retirement SHALL cover asynchronous capture and current-source reads as well as child execution. Teardown SHALL close admission, signal cancellable work and drain before releasing owned storage; late preparation callbacks SHALL not attach to a replacement generation. Busy parent release/reads SHALL reject consistently. Captured results SHALL remain readable while disabled in a live generation. Compaction alone SHALL retain progress, and no lifecycle event SHALL refund dispatched or unknown attempts. No evidence cache SHALL persist across sessions.

#### Scenario: Disable during preparation
- **WHEN** disable or navigation occurs while file acquisition is in progress
- **THEN** no later provider attempt starts, teardown waits for cleanup and no orphan capture or late-generation parent remains

#### Scenario: Release during current-file verification
- **WHEN** a current-source check is still running
- **THEN** release cannot free its owned capture prematurely and lifecycle teardown drains that read before expiry
