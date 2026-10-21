# Record-filtering verification map

This maps Phase C's implemented **record** behavior to deterministic tests under `test/`. All classifiers are fake and all evidence is synthetic. These tests establish operational behavior, not label accuracy, confidence calibration, measured savings or release readiness. Current command evidence is in [goal progress](goal-progress.md); the complete requirements remain in [semantic acceptance](semantic-acceptance.md).

| Case | Concrete assertions | Remaining scope |
| --- | --- | --- |
| SM-01 | `semantic-views.test.mjs`: cutoff boundaries, raw negative and insufficient outcomes, mutation isolation. `extension.test.mjs`: three native labels survive the production wrapper. | Real semantic correctness is H. |
| SM-02 | `extension.test.mjs`: malicious record instructions cannot grant authorization, read provenance or fabricate locations; controlled positive/negative/insufficient and malformed responses remain distinct. | Realistic labeled quality and final I audit. |
| SM-03 | `semantic-contracts.test.mjs`: duplicate/unknown fields, malformed Unicode, every UTF-8/count bound; `semantic-parents.test.mjs`: atomic admission and maximum canonical submission. | None for records. |
| SM-04 | `semantic-results`/`extension`: hostile claimed paths stay unverified with null file ranges, checkCurrent is data-only; `semantic-views` uses captured text only. | Verified files and expansion are D/G, not passed. |
| SM-05 | `semantic-host-integration`: generic bool/score/choice remain native, separate physical clients share execution with semantic work. Existing `validation`/`classifier-adapter` regressions preserve native values. | Final I audit. |
| SM-06 | `semantic-preparation`: exact transmitted state, identity and caller-attribution separation; `semantic-execution`: new record IDs reuse identical content without requests; `semantic-results`: pure independent cutoff views. Core `coordinator` tests rubric/config changes. | Search/preparation variants are D–G. |
| SM-07 | `semantic-execution`: prepare, nine-of-ten execution, pending resume, atomic mixed retry selection and lifetime caps; `extension`: production wrapper partial continuation. | None for records. |
| SM-08 | `semantic-results`: stable complete traversal, wrong view/limit, tampered/stale cursors, busy reads; `semantic-execution`: invalid retries preserve revision. | Search cursor state is E/F. |
| SM-09 | `semantic-execution`: completed eight-record child with two unsubmitted records cannot complete its parent; `semantic-results`: all record partitions. | File passages/expansion obligations are E/G, not passed. |
| SM-10 | `semantic-execution`: decreasing cross-child request/byte/deadline budgets under concurrent generic spend; `coordinator`: retries and uncertain charged deltas. | The literal initial-plus-expansion scenario is G, not passed. |
| SM-11 | `semantic-execution`/`semantic-lifecycle`/`extension`: parent cancellation and disable hold slots until abort-ignoring providers settle; core `scheduler`/`coordinator`: queued versus dispatched distinction and nondispatch release. | File search and final I audit. |
| SM-12 | `semantic-execution`: changed model at child boundary blocks later dispatch; core `controls`/`coordinator`: configuration fingerprints and in-flight pin changes. | Expansion is G, not passed. |
| SM-13 | `semantic-host-integration`: actual Pi loader/wrapper/pipeline and QuickJS codemode report child usage once, retrieval contributes none; unknown usage stays charged; parallel physical library copies conserve the same allowance. `semantic-execution`: eligible zero-request reuse. | Live pricing/quality measurement is H. |
| SM-14 | `semantic-lifecycle`: cancelled/successful navigation, compaction, disable/re-enable, replacement reasons and late settlement races. `extension`/`session-adapter`: actual branches/fork/reopen and cumulative all-branch ledger. | Final I end-to-end audit. |
| SM-15 | `memory`/`semantic-parents`: eight parents, shared 32 batches and 8 MiB, exact maximum input, rollback, partial workspace_full; `extension`: idle/busy parent release with unrelated handles and charges unchanged. | Files/search capacity is D/E. |
| SM-32 | `extension`: fabricated native location label and private provider exception become sanitized failures; deterministic record attribution remains unverified; diagnostics/ledger omit text/provenance. `classifier-adapter`: invalid native identity cannot leak usage labels. | Verified file location/freshness is G; final I audit. |
| SM-33 | `extension`: every registered wrapper result checked against outputSchema, success/partial/error/data-only cases; `semantic-host-integration`: actual structured calls from codemode, hidden exposure and usage ownership. | File/search/expansion envelopes are later phases. |
| SM-34 | `semantic-host-integration`: all four family settings and two physical extension/library copies, one command owner; `package`: inert import. | Offline installed-artifact check also exercises all four family configurations; final I release matrix remains. |

Phase C itself did not implement file discovery and safety SM-16–24; Phase D's separate [filesystem verification](filesystem-verification.md) covers those primitives. Systematic search SM-25, discovery SM-26–27, expansion SM-28–30 and N#HH rendering SM-31 remain **not implemented or passed**. Record snippets test whole-line truncation and output_limit but do not claim N#HH compatibility. EV-01–06 remain **unmeasured**: no corpus acquisition/label adjudication or live pilot occurred.

The actual codemode tests run Pi's QuickJS worker, not a substitute JavaScript evaluator. The isolated runner grants worker permission only to that test file; temporary credentials/config roots, filesystem limits and network denial remain inherited. Host checks prove wiring and accounting, not frontier-agent task success.

## Phase C final delta reconciliation

Same-agent implementation audit, not independent review or semantic label adjudication. The four Phase C deltas were compared with the implementation and Phase B sections 2–6 plus record portions of 8–9. After apply, the separate authorized closeout synchronized all four deltas, verified every requirement against the main specs and archived the completed change; see [goal progress](goal-progress.md).

| Delta requirement | Implementation seam and verification |
| --- | --- |
| Atomic identified record admission | Closed copied UTF-8 validation before parent allocation; `semantic-contracts` and maximum-size/atomic `semantic-parents` tests. |
| Unverified record provenance without filesystem authority | Preparation sends only predicate/text/source kind; snippets use captured text only. `semantic-preparation`, `semantic-views`, `semantic-results` and hostile-provenance extension assertions. |
| Explicit semantic judgment and cutoff policy | Exact frozen semantic-v1 question, raw choice retention, pure three-way mapping; `semantic-preparation`, `semantic-views` and production-wrapper outcome tests. |
| Shared bounded parent execution | Shared coordinator, one eight-record child ahead, internal charged-unit bridge and one remaining budget/deadline; `semantic-execution`, `coordinator`, actual `semantic-host-integration`. |
| Safe parent continuation and coverage | Retained child attempts/successes, atomic retry validation, complete record partitions and pinned identity; `semantic-execution`/`semantic-results`. |
| Pure bounded result views and snippets | Authenticated stateless runtime/revision/view/limit cursors, 128 KiB envelopes, whole-line captured snippets and zero-call views; `semantic-results`/`semantic-views`. |
| Parent cancellation and conservative expiry | Owner-controlled gate/abort/drain/expire, semantic cleanup before core expiry, single-flight retirement and sem-handle release; `semantic-lifecycle`, `extension`, installed consumer. |
| Shared retained-data admission and explicit limits | One coordinator memory pool; eight parents/32 batches/8 MiB, measured copies and reserved growth, no silent eviction; `memory`, `workspaces`, `semantic-parents`. |
| Structured tools and once-only usage | Fixed semantic consumer, schema-matching wrappers, sanitized errors, invocation delta only; `extension`, real Pi/QuickJS `semantic-host-integration`, installed consumer. |
| Managed batches: Ephemeral identity-safe reuse and workspaces | Existing generic identities/retry/reuse behavior retained; shared memory refactor tested by original workspace/coordinator regressions plus cross-owner tests. |
| Session controls: Conservative lifecycle invalidation | Original disable/fork/compaction semantics retained; parent generation added to owner teardown. Original generic lifecycle regressions and new late-child/replacement races pass. |
| Toolkit integration: Structured codemode tools | Exactly three generic plus four semantic definitions, no search definition; all family configurations, physical copies, inert public ESM/types and externally supplied unbundled peers verified. |

All three MODIFIED requirements exist in the main specs, and their original scenario headings are retained in the deltas. The lifecycle reopen scenario intentionally adds semantic search_expired alongside generic batch_expired and stale-facade runtime_expired. No unrelated main-spec requirement is removed. The separate synchronization preserved every other main requirement, purpose and title; all merged delta requirement blocks were compared exactly before archive.

Implementation refinements stay within the approved design: the internal managed result carries batch identity for orphan cleanup and preserves uncertain accounting across projection errors; retirement is single-flight to prevent an overlapping startup from allocating a replacement scheduler while old work drains. Neither changes the public library facade, discovery protocol, ledger format, user defaults or dependency policy.

Installed verification uses a private local tarball and temporary offline consumer. It checks inert imports/public types, seven definitions, all family exposures, disabled refusal, record partial execution/continuation, raw-preserving cutoff views, captured evidence, release and generic execution. Only fake classifiers execute; the consumer and artifact are removed. Exact observed results are recorded in [goal progress](goal-progress.md), not inferred from checked tasks.

### Remaining gates are not Phase C successes

- Phase D supplies internal safe filesystem capture; Phase E now provides [systematic search](search-verification.md). F–G still own discovery, verified same-file expansion and actual N#HH compatibility. Record filtering itself grants no filesystem access.
- H must acquire/verify source snapshots and independently adjudicated labels, freeze tuning, then run explicitly authorized live comparisons. The unchanged gates include 24 held-out tasks, at least 100 positive spans and six genuine negatives; recall >=0.90, precision/per-source recall >=0.80, unresolved <=0.25; discovery positive/negative performance >=0.80; median evidence-token ratio <=0.75 and latency ratio <=2.0 without reduced success, three paired repetitions and a demonstrated managed operational advantage.
- Missing live authorization, credentials, ground truth or prices is not a pass or zero cost. This implementation makes no quality/savings claim and performed no live smoke or publication.
- I still owns full-product hardening and release readiness. A Phase C package installation check is not completion of that release gate.
