# Proposal

## Why

The approved design contract defines product invariants, but explicitly leaves coordinator ownership, command/API shapes, and lifecycle/accounting rules unresolved before implementation. Starting semantic grep now would embed those decisions independently in several consumers; a bounded execution-contract slice removes that risk before the first runtime code is written.

## What Changes

- Produce an implementation-facing managed-execution contract covering the single package, side-effect-free library boundary, shared coordinator, generic batches, user controls, and saved-session accounting.
- Resolve the specific Pi integration questions needed to implement that contract, documenting the checked Pi version, supported mechanisms, and limitations rather than assuming APIs exist.
- Provide concrete request/result examples, state transitions, failure codes, and a deterministic acceptance-case matrix for the first executable generic-batch slice.
- Add a project documentation entry point linking the existing conceptual baseline and the new contract; retain the original baseline in place.
- Identify the next executable slice and its entry criteria. Do not plan the entire semantic-search implementation in this change.

## Capabilities

### New Capabilities

None delivered at runtime. This is a documentation-only change with `skip_specs: true`; it specifies the implementation handoff, not a claim that managed execution exists.

### Modified Capabilities

None. The repository has no existing main specs. Future executable changes will introduce behavioral delta specs.

## Impact

Planned deliverables are `README.md`, `docs/managed-execution-contract.md`, and `docs/managed-execution-acceptance.md`. The existing `pi-decision-tools-design.md` remains the conceptual authority. No package manifest, runtime dependencies, provider calls, tool registration, or executable implementation is introduced by applying this change.

## Non-goals

Semantic grep/filter implementation; filesystem discovery, windows and hashlines; semantic rubric/cutoff tuning; pilot performance claims; a general workflow framework; durable batches/searches; Pi Durable; publishing or choosing a final registry name. Use `pi-decision-tools` provisionally, as the baseline already does.

## Why this goes first

A package scaffold alone does not resolve the highest-risk shared behavior. A full search vertical slice is premature while transmission authorization and cumulative accounting are underspecified. Generic managed execution is independently useful and underpins both future tool families, so its contract is the smallest useful first decision boundary.
