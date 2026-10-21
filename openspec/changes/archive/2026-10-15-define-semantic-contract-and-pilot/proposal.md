# Proposal

## Why

Phase A supplies verified shared generic execution, but the semantic evidence, judgment, coverage, and evaluation contracts remain unresolved. Fixing those contracts before phases C–G avoids incompatible filters/searches and prevents later tuning from moving release gates to fit results.

## What Changes

- Create a documentation-only implementation handoff: `docs/semantic-contract.md` for the rubric, raw answers and derived cutoffs, evidence/provenance identities, closed operation schemas, paging, parent continuation, cancellation, and one same-file expansion.
- Specify deterministic filesystem discovery, non-Git behavior, exclusions, freshness, bounded windows, and experimental scope/output limits without implementing filesystem access or model execution.
- Create `docs/semantic-acceptance.md`, tracing each semantic obligation to falsifiable future deterministic/integration cases and its phase C–G owner.
- Create `docs/pilot-plan.md`, defining representative task families, independently reviewed labels, tuning/held-out separation, generic/native and semantic/frontier baselines, metrics, numerical promotion gates, and explicit live authorization prerequisites. No pilot is executed in this change.
- Correct stale status statements and link the handoff from the README and goal progress record. Preserve historical requirement text, the approved execution invariants, and the full A–I roadmap.

## Capabilities

### New Capabilities

None. This change produces documentation, not available tools or accepted runtime behavior. `.openspec.yaml` declares `skip_specs: true`; no delta spec files are created.

### Modified Capabilities

None. The existing `toolkit-integration`, `session-execution-controls`, `cumulative-execution-accounting`, and `managed-decision-batches` requirements remain unchanged. Future executable changes must introduce their own behavioral deltas rather than treating these proposed interfaces as implemented.

## Impact

The affected deliverables are Markdown documentation and planning records only. No runtime, public export, dependency, configuration default, tool registration, credential, or provider invocation changes. The intended reader is a contributor who must implement phases C–G and conduct phase H without reconstructing design discussions. Documentation review proves a coherent handoff, not semantic accuracy, performance, measured utility, or release readiness.

Non-goals: production filtering/search, persistent workspaces, embeddings, autonomous cross-file investigation, changes to generic native-answer semantics, live smoke/evaluation, publication, or permission to apply later changes.
