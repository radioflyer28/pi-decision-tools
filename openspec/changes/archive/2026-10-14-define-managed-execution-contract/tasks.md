# Tasks

## 1. Establish verified integration constraints

- [x] 1.1 Create `docs/managed-execution-contract.md` with its status, audience, outline, and baseline reference; verify it explicitly distinguishes proposed toolkit behavior from currently implemented behavior.
- [x] 1.2 Resolve the finite Pi integration checklist in design.md using installed documentation and relevant examples; record version, supporting references, selected mechanisms, and limitations for classifiers, structured output, coordinator sharing, lifecycle, and ledger persistence. Verify every checklist item has evidence; stop for a user decision if any baseline invariant cannot be supported.

## 2. Specify the managed execution boundary

- [x] 2.1 Document extension/library entry points, explicit coordinator ownership/access, interface compatibility, duplicate-copy registration behavior, and independent tool-family exposure; verify the documented call paths all reach the same authorization, scheduler, and accounting domain without import-time side effects.
- [x] 2.2 Define concrete command/configuration names and authorization/model/lifecycle transition tables, including noninteractive execution, disable/cancel, model switching, reopen, branch, fork, session switch, and reload; verify every event has explicit authorization, handle-validity, and in-flight-work consequences consistent with the baseline.
- [x] 2.3 Define minimal generic batch and experimental library operation schemas, limits, failure codes, identity/reuse rules, pagination, and structured examples for success, failure, partial work, continuation, and expiry; verify choice/bool/score are supported and no generic outcome is conflated with semantic-search coverage.
- [x] 2.4 Specify cumulative ledger units, reservation/dispatch/reconciliation transitions, retry charging, unknown usage, user replenishment, shared concurrency, and usage reporting; verify worked examples for two parallel consumers, interrupted dispatch, re-enablement, and older-branch navigation cannot overspend or rewind the allowance.

## 3. Establish the implementation handoff

- [x] 3.1 Create `docs/managed-execution-acceptance.md` with stable case IDs covering every acceptance category in design.md; verify each case states initial conditions, event, expected result, provider-call/accounting expectations, and baseline traceability.
- [x] 3.2 Add the next executable generic-batch slice and its entry/exit criteria to the contract, separating deterministic fake-provider verification from an explicitly opted-in native smoke test; verify semantic tooling, persistent workspaces, and performance claims remain deferred.
- [x] 3.3 Add `README.md` linking the unchanged conceptual baseline and both new documents, retaining the provisional package name and unimplemented status; verify all relative links resolve and no manifest, dependencies, or runtime code were added.
- [x] 3.4 Perform a cold-reader walkthrough of submission, partial continuation, disable during dispatch, restart, and branch navigation using only the new documents; verify schemas, transition tables, accounting examples, and acceptance cases agree, with no unresolved implementation-blocking decisions. Record review results and limitations in the acceptance document.
