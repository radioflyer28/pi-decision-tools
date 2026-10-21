# Proposal

## Why

The verified generic executor and archived Phase B contract are ready to support the first production semantic capability: filtering caller-supplied records without filesystem access. Implementing that bounded slice now establishes reusable parent results and continuation while preserving one authorization, scheduling, memory and accounting domain.

## What Changes

- Implement `semantic_filter`, `semantic_results`, `semantic_continue` and record-only `semantic_evidence` with closed schemas and structured envelopes from the Phase B contract.
- Apply semantic-v1's match/no-match/insufficient-context rubric; retain raw answers, provenance, unresolved and failure outcomes, and support zero-call cutoff re-filtering.
- Add bounded parent workspaces, invocation-wide lower ceilings across child batches, pinned-model continuation, explicit eligible retries, cancellation/drain and generation expiry through the existing owner.
- Share the existing 8 MiB retained-data budget with semantic evidence/results; retain the 32-child-batch limit and add the planned eight-parent limit. Extend idle release to semantic handles without granting authority or refunding liability.
- Register semantic tools behind the existing independent family flag (still false by default), update documentation and verify disabled/generic-only/semantic-only/combined configurations, cross-copy ownership, installed packaging and nested usage.
- **Compatibility note:** registration grows from three generic tools to seven total definitions, with disabled-family definitions hidden. Generic names, schemas, library exports, protocol 1, defaults and ledger format remain unchanged. Tests must assert exposure and behavior rather than treating three as the permanent total.

## Capabilities

### New Capabilities

- `semantic-record-filtering`: bounded identified record filtering, semantic judgments, raw-answer views, snippets, parent coverage, safe continuation and shared enforcement.

### Modified Capabilities

- `toolkit-integration`: add the four structured semantic record operations without replacing generic tools or adding another coordinator.
- `managed-decision-batches`: make the retained-data ceiling explicitly shared across generic batches and semantic parent/child workspaces.
- `session-execution-controls`: distinguish generic batch expiry from semantic operation expiry while retaining every existing lifecycle guarantee.

## Impact

Runtime work is focused on a new internal semantic module, a narrow core invocation/memory bridge, owner/lifecycle/command integration and semantic tool schemas/wrappers. Tests, package verification and usage/status documentation will change. No new runtime dependency, provider SDK, public semantic library facade or persistent evidence store is needed.

Non-goals: `semantic_search`, file discovery/opening, verified file evidence, context expansion, hashline rendering, live pilot/smoke execution, quality claims, changed release gates or publication. These remain phases D–I. Planning does not authorize apply or live transmission.
