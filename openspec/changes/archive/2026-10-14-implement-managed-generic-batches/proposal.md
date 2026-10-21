# Proposal

## Why

The approved execution contract now specifies authorization, persistence, and batch semantics, but the repository has no executable package. Implementing the generic managed-batch path first provides independent codemode utility and verifies the shared enforcement domain that later semantic tools must reuse.

## What Changes

- Create one TypeScript/ESM Pi package with an extension entry and a side-effect-free experimental library entry.
- Implement explicit cross-copy coordinator ownership, protocol compatibility, shared scheduling, and runtime lifecycle invalidation.
- Implement disabled-by-default user controls, exact classifier model selection, independently checked tool-family permissions, and noninteractive startup opt-in.
- Implement the approved persisted-conversation gate and cumulative all-branch grant/reserve/settle/release accounting, including conservative unknown liabilities and storage-fault handling.
- Expose `decision_submit`, `decision_results`, and `decision_continue` with bounded JSON state, native choice/bool/score answers, explicit partial/failure outcomes, pagination, reuse, and expiry.
- Verify the 38 execution acceptance cases with deterministic fixtures and Pi integration tests; add a separately opted-in native smoke-test path without treating absent authorization or credentials as success.
- Document local use, library consumption, compatibility, usage reporting, and unvalidated performance assumptions.

## Capabilities

### New Capabilities

- `toolkit-integration`: One package, library import purity, owner discovery, compatible copies, structured codemode tools, and accounting-boundary integration.
- `session-execution-controls`: Explicit authorization, model resolution/pinning, configuration, family gates, and lifecycle policy.
- `cumulative-execution-accounting`: Persisted-conversation readiness, non-rewinding cumulative allowance, reservations, conservative recovery, shared concurrency, and truthful diagnostics.
- `managed-decision-batches`: Validated bounded submission, typed judgments, continuation, failure/retry identity, pagination, runtime reuse, and ephemeral workspaces.

### Modified Capabilities

None; the main-spec inventory is empty.

## Impact

Adds the package manifest, lockfile, TypeScript build configuration, runtime modules, deterministic and host-integration tests, a smoke-test command, and user/library documentation. Pi host modules remain peer dependencies and are not bundled; exact tested development versions are locked. The original conceptual baseline remains unchanged. Update the execution contract only to reconcile explicitly documented implementation clarifications, not to weaken invariants.

## Non-goals

Semantic filtering/search implementation, filesystem evidence preparation, hashlines, model/rubric quality tuning, persistent inputs/results/checkpoints, background jobs, Pi Durable, provider/auth SDK duplication, publication, pushes, or performance-benefit claims. A local package build is in scope; the overall initial release and evaluation remain later goal phases.
