# Generic execution verification map

## Evidence and limits

Historical Phase A verification (before semantic implementation): `npm run typecheck` and `npm test` exit 0; **140 tests across 19 files** pass. Tests use isolated temporary Pi sessions and fake native classifiers. `host-integration.test.mjs` uses Pi 1.2.0's actual physical-module loader, extension runner, tool wrappers, agent-core tool-call pipeline and nested-call usage recorder. It does not run a frontier model or a live classifier.

The table maps clauses to concrete test files under `test/`, not merely matching EX labels. The supplemental audit variations are now exercised by assertions, including physical-copy parallelism, actual branches/forks/compaction, malformed native output, mixed retry rejection and in-flight model changes. These tests establish the generic operational clauses below, not semantic quality or performance benefit.

## Clause mapping

| Requirement | Assertions and files |
| --- | --- |
| EX-01 | `controls`, `extension`, `host-integration`: default disabled despite available fake model; direct tool, library and actual nested tool pipeline return disabled; no classifier calls. |
| EX-02 | `extension`: saved default alone cannot execute, accepted/declined confirmation, transmission text, disable. `controls`/`coordinator`: no command grant reset; disable blocks new work and drains started promises. |
| EX-03 | `controls`: sole/default/explicit selection and missing/ambiguous errors. `extension`: no-UI ambiguity and explicit missing model never fall back. The interactive multi-model picker is also exercised with explicit confirmation and zero classifier calls. |
| EX-04 | `extension`: exact startup model including slash, full budget, missing flags, resume and new-instance reload do not re-enable. `controls`: frozen ceiling increases rejected. Bad budgets, absent opt-in and unavailable exact startup models remain disabled with zero grant/calls. |
| EX-05 | `session-adapter`: real custom-only session has no file, nonpersistent session cannot grant, real user message makes persistence ready. `coordinator`: preparation and executable submission refusal preserve handles; zero calls. |
| EX-06 | `owner`: two physical compiled library copies connect through real Pi bus wrappers. `host-integration`: two physical extension copies load with one command/owner/tool set and one ledger charge. `package`: library subprocess has no active resources/output. Three concurrent clients from separate copies contend for one remaining allowance: only two additional invocations occur, cumulative charge is three, concurrency stays bounded and excess work remains pending. |
| EX-07 | `owner`: no owner, incompatible version and conflicting responders fail; conflict immediately disables the existing runtime and denies prior facades; no fallback factory. |
| EX-08 | `controls`: all four family combinations, independent library authorization. `extension`: hidden generic tools still reject direct execution. `semantic-parent`: all consumers share allowance. |
| EX-09 | `scheduler`: round-robin dispatch and global active slots. `controls`: composed scheduler/reservation tests across three consumers. `semantic-parent`: exactly three permitted calls across concurrent generic/library/parent batches. |
| EX-10 | `validation`: duplicate IDs, JSON cycles/accessors/prototypes, nonfinite values, malformed Unicode, count/UTF-8 bounds, exact keys and caller mutation. `workspaces`: atomic memory rejection. `controls`: over-limit runs denied before reservation. |
| EX-11 | `classifier-adapter`/`validation`: native choice/bool/score values preserved. `workspaces`: declared choice abstention remains completed, not failed. |
| EX-12 | `coordinator`: one-request submit leaves pending work, continuation calls only the remaining item, two total charges. |
| EX-13 | `coordinator`/`results`: complete-with-failures remains distinct from all-success and paging truncation; default continuation does not reopen failed work. |
| EX-14 | `validation`: attempted input/model mutation fields rejected. `coordinator`: wrong identity/successful retry IDs do not advance revision or mutate outcomes. |
| EX-15 | `coordinator`: different item ID hits, evidence/inputVersion/question/rubric/abstention changes miss, in-flight and failed work not reused, authorization/persistence gate hits too, release removes optional references. Changed endpoint fingerprint and generation clearing each miss reuse and incur fresh charges. |
| EX-16 | `validation`/`classifier-adapter`: missing/extra/type/range/label/probability and actual-model errors reject without retry. `coordinator`: malformed answer charged as failure. A >64 KiB native answer is rejected charged, without retry or reuse. |
| EX-17 | `classifier-adapter`: native maxRetries=0, structured transient statuses only. `coordinator`: automatic retry success and lifetime-bounded charged retries across continuations. |
| EX-18 | `classifier-adapter`: auth status, unknown status and error prose do not imply retries; identity/malformed results not eligible. `controls`: missing model is preflight failure with no fallback. |
| EX-19 | `validation`: duplicate/unknown shape. `coordinator`: rejected successful retry IDs, exhausted lifetime, zero-budget retry preserves failure, explicit abort retry. Mixed eligible/successful/unknown/duplicate selections preserve revision and the prior failed outcome; a later valid retry invokes only that failed item. |
| EX-20 | `coordinator`/`extension`: disable reaches native signal, waits for ignored abort, retains pending work and unknown charge, re-enable does not reopen failed item. |
| EX-21 | `scheduler`: queued cancellation never executes; running cancellation retains slot; fake-clock invocation/attempt deadlines and observed overrun. The integrated coordinator uses a controlled clock to prove queued expiry stays pending, running expiry retains its slot until settlement and unknown usage remains charged. |
| EX-22 | `controls`: switched/configuration-changed pin refused; original selection can resume. `coordinator`: old prepared batch does not migrate. An in-flight old-model attempt settles successfully, pending old work stops, and restoring the original selection resumes only that pending item. |
| EX-23 | `controls`/`coordinator`: independent R/B ceilings, zero/lower/higher caps, shared atomic reservations, retries consume remaining allowance. |
| EX-24 | `ledger`/`session-adapter`: unresolved reservation survives real file reopen without refund; unknown attempts retained. `owner`/`extension`: replacement invalidates old facade and starts disabled. |
| EX-25 | `ledger`: physical append order ignores parent links. `session-adapter`: real older-branch navigation/reopen preserves old charge. `extension`: cancelled/successful tree transitions preserve/expire handles correctly. Actual spending on X and Y, return to X, file reopen and re-enable retain both charges and only the original grant. |
| EX-26 | `owner`/`extension`/`coordinator`: stale same-ID facade, reload/resume, before-switch abort/drain, expiry waits and clears. `ledger`: foreign-session inherited grants ignored. A real createBranchedSession carries transcript custom entries but gets zero inherited active grants/charges and disabled authority; new spending does not change the parent's file. |
| EX-27 | `controls`/`extension`: re-enable retains historical spending; replenish adds exact grants without enabling or clearing unknown attempts. |
| EX-28 | `session-adapter`: missing storage, memory-only append, append-then-throw, before-append failure, failed release read-back all latch. `coordinator`: settlement failure returns available answer/usage but stays disabled and charged. |
| EX-29 | `session-adapter`: only current-runtime non-dispatch proof allows release; reopened reservation cannot be refunded; failed release stays charged. `controls`: disable/abort final gate leaves provably undispatched reservation releasable. |
| EX-30 | `ledger`: unknown namespaces/versions, duplicate IDs/sequence/attempts, illegal transitions, overflow and independent overspend rejected. `session-adapter`: corrupted/missing initialized file never becomes a new grant. |
| EX-31 | `coordinator`: one-shot/continue report only their own usage delta; results/reuse have none. `host-integration`: real nested pipeline recorder totals one invocation once across submit/results/reuse and records parent IDs. Library consumers must report deltas once at their own boundary. |
| EX-32 | `results`: optional Usage fields summed, unknown usage remains null until known values arrive, unknown pricing retained. `coordinator`: unreported abort usage is explicitly counted and charged. |
| EX-33 | `results`: ordered snapshots, 128 KiB whole-envelope cap including error metadata, authenticated wrong/stale cursor rejection and restart. `coordinator`: busy retrieval refused. |
| EX-34 | `workspaces`: bounded count/input/active answer growth, no silent eviction, release/clear expiry. `owner`: stale facades fail. No implicit resubmission. |
| EX-35 | `semantic-parent`: adversarial synthetic evidence cannot enable, returned diagnostics and actual session ledger omit raw evidence/rubric/provider exception. `ledger`: unexpected private fields rejected. Ordinary Pi transcript exposure documented separately. |
| EX-36 | `semantic-parent`: completed child is not parent completeness; unsubmitted/expansion obligations, cancellation, pinned follow-ups and shared allowance asserted. This fixture is not semantic search. |
| EX-37 | `extension`: compaction event leaves current handle usable; `session-adapter`/`owner`: reopening preserves ledger but replaces runtime. A real compaction entry followed by continuation executes only pending work; reopening expires its handle while retaining both charges. |
| EX-38 | `config`: unknown/malformed config rejected; write/rename failures preserve previous bytes and clean temporary files; success does not store enabled state. `extension`: default saving does not authorize. |

## Release verification and remaining handoff

- Fresh `npm ci --no-audit --no-fund` installed 119 packages, followed by successful typecheck, clean build and all 140 tests. Strict OpenSpec validation passed.
- `documentation.test.mjs` validates the documented configuration, submit, continue and smoke budgets, typechecks the library example against emitted public declarations and checks reader-entrypoint links.
- `npm run verify:package` packs locally, rejects source/test/cache/auth/bundle paths, installs the tarball offline into a temporary consumer, supplies verified local host peers externally, and checks both ESM exports, inert library import and public TypeScript declarations. The package is private; no publication was attempted. Temporary artifacts are removed after verification.
- The physical-copy audit found a real transient model-availability race. Single-flight atomic refresh fixes it; a failed refresh still clears the snapshot, and dispatch still awaits discovery. A separate privacy test ensures invalid native identity strings cannot leak through usage labels.
- The user explicitly confirmed the bounded design reconciliation and sync/archive. All four new main specs were created from their added requirements, with full Purpose/requirement/scenario text compared exactly and strict validation passing before archive. The completed change is archived as `2026-10-14-implement-managed-generic-batches`. Later phases B–I remain outside this slice.

Live smoke: **not run**. Only refusal behavior is tested. Phase C record coverage is tracked in [semantic verification](semantic-verification.md). Filesystem/search/expansion and actual evaluation gates remain later phases, not completed by this generic slice.
