# Spec Delta

## MODIFIED Requirements

### Requirement: Pure bounded result views and snippets

semantic_results SHALL retrieve record-compatible SemanticPage envelopes with all mandatory identity, policy, raw/final outcome, coverage, usage, ledger and pagination fields. Re-filtering SHALL make zero provider calls and SHALL NOT change raw answers or processing progress. Pages SHALL default to20, allow1–100 items and cap the whole envelope at128KiB. Cursors SHALL bind parent/generation/revision/view/limit; changed revisions SHALL fail cursor_stale and mismatched view/limit cursor_invalid. Busy parent reads SHALL fail search_busy. Shared operations MAY also serve captured-file search parents under their separate systematic-search contract without weakening record guarantees.

Every record result item SHALL include a bounded plain captured snippet, defaulting to20 lines/2KiB. For record parents, semantic_evidence SHALL accept1–20 unique parent-owned evidence IDs, bounded line offsets and at most100 lines/16KiB per requested snippet within the page cap, without model calls or source file reads. Record path/ranges SHALL remain null and freshness unverified, including when checkCurrent is true. Whole-line truncation, next offsets and output_limit SHALL be explicit; no partial line SHALL masquerade as complete evidence.

#### Scenario: Re-filter then page
- **WHEN** a caller selects a higher cutoff and traverses that fixed view using matching policy/limit cursors
- **THEN** only derived outcomes change, each item appears once, and no provider usage is newly reported

#### Scenario: Oversized display line
- **WHEN** a captured record's first line exceeds the selected snippet byte limit
- **THEN** output reports truncation and a bounded retrieval path or output_limit without fabricating a partial line or filesystem anchor
