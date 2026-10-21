# Semantic acceptance and phase ownership

## Status and use

**Requirements matrix, not a blanket pass claim.** Phase B established this handoff on 2026-10-15. Phase C's record-only test coverage and remaining clauses are mapped in [record verification](semantic-verification.md). Phase D's SM-16–24 implementation and platform verification are mapped in [filesystem verification](filesystem-verification.md). Phase E's systematic-search coverage is mapped in [search verification](search-verification.md). Phase F's direct discovery evidence and completed runtime/platform gates are mapped in [discovery verification](discovery-verification.md), with [operational comparisons/live procedure](discovery-evaluation.md). Contributors use this matrix to implement phases C–I and trace the complete phase-B handoff. Read the [semantic contract](semantic-contract.md), [pilot plan](pilot-plan.md), [managed acceptance](managed-execution-acceptance.md) and [goal](../goal.md). Generic test adapters demonstrate shared enforcement only; they do not satisfy these production semantic cases.

Each future test asserts structured data AND side effects: provider calls, charged requests/bytes, file reads, current source identity and workspace changes. Unless otherwise stated, a persisted authorized session, enabled semantic family, correct pinned model and sufficient bounded resources exist. Failures may never be transformed into no-match. Synthetic inputs in tests are not semantic ground truth for realistic evaluation.

## Observable cases

| ID | Scenario and required observation | Side effects / phase owner |
| --- | --- | --- |
| SM-01 | Raw match at/above cutoff accepted; below cutoff unresolved; raw no-match stays negative; raw insufficient stays unresolved even at cutoff zero. | Pure mapping, zero additional calls; C. |
| SM-02 | Positive/negative/ambiguous records and malicious embedded instructions return valid explicit outcomes; malicious text cannot enable or widen scope. | Same shared authorization, no permissions from answers; C/I. |
| SM-03 | Duplicate record IDs, unknown fields, invalid Unicode, excessive text/provenance/predicate or aggregate bytes reject atomically. | Zero calls/accepted partial workspace; C. |
| SM-04 | Caller provenance names an outside-root secret file with plausible line/hash values. | Remains unverified; no file open/expansion; C/G. |
| SM-05 | Bool/score/choice generic answers still retain their original semantics while semantic family runs concurrently. | One owner/scheduler/allowance, no match coercion in core; C/I. |
| SM-06 | Change predicate/rubric/model/preparation/evidence; separately change only cutoff or a record's caller ID while retaining identical reusable content. | Execution change requires new work; cutoff reuses raw answers with zero calls/charges; opaque IDs cannot defeat otherwise eligible reuse; C. |
| SM-07 | Prepare, one-request execute, continue pending, explicitly retry eligible failed ID; reject success/unknown/duplicate retry selections together. | Preserve successes and lifetime attempts; atomic invalid selection; C. |
| SM-08 | Page a fixed revision, change cutoff/limit, continue, reuse an old cursor; retrieve while running. | Stable order, cursor_invalid/stale or search_busy, no hidden calls; C/E. |
| SM-09 | Completed child has unsubmitted initial passages or pending expansion. | Parent incomplete, partition totals correct; E/G. |
| SM-10 | Parent call has three requests; initial children consume two and expansion one while a generic caller spends concurrently. | Parent cannot spend a fourth; internal deltas exclude unrelated spending and include retries/unknown usage; C/E/G. |
| SM-11 | Cancel while queued versus dispatched; provider ignores abort temporarily. | Pending versus failed explicit; slot held until settlement, no refund merely for cancellation; C/E/I. |
| SM-12 | Change selected model/fingerprint between child batches or before expansion. | No new mismatched dispatch; started old-model work settles and remains charged; E/G. |
| SM-13 | Retrieve/re-filter/reuse/aggregate after known and unknown usage responses through actual nested Pi calls. | Native usage reported once at owning boundary, ledger once; unknown prices not free; C/I. |
| SM-14 | Disable/re-enable, compaction, tree navigation/cancelled tree, fork/reload/reopen/replacement. | Correct generation expiry, disabled transitions, cumulative all-branch liability; search_expired without rescan; C/I. |
| SM-15 | Combined generic/semantic memory or handle bounds reached; release idle or busy semantic parent. | Atomic workspace_full, no silent eviction; busy release rejected; no ledger refund; C/E. |
| SM-16 | Tracked, nonignored untracked, ignored untracked and deleted tracked paths appear in a Git tree. | Correct working-tree candidate union; no index-blob resurrection; D. |
| SM-17 | No Git: omitted/directory scope versus explicit regular file list. | git_required before work for implicit traversal; explicit confined files supported; D. |
| SM-18 | Absolute/UNC/drive/traversal paths, intermediate/final symlinks or junctions, devices, root escapes and path-case aliases. | Confinement fails closed; no outside bytes/model calls; POSIX/Windows cases; D/I. |
| SM-19 | Tracked and explicitly requested sensitive/generated/binary/oversized files; misleading case and segment prefixes. | Same independent exact exclusion rules; tool cannot bypass; totals and bounded reasons omit content; D. |
| SM-20 | Nested repository/submodule and user-added exclusion. | No implicit descent; configuration can add exclusions only; D. |
| SM-21 | Empty file, trailing LF, lone CR, CRLF, BOM, Unicode and invalid UTF-8/NUL. | Exact lines/hashes and documented decoding; invalid content excluded, no phantom line; D. |
| SM-22 | Window at 64-line/8KiB boundary, overlap, one huge line, neighboring excluded range. | Progress guaranteed; exact contiguous whole-line ranges; oversized line excluded, no silent truncation/join; D. |
| SM-23 | Enumerate >10,000 entries, admit >256 files, produce >2,048 windows or hit combined memory bound. | Incomplete scope, unknown remaining totals where appropriate, not exhaustive no-match; D/E. |
| SM-24 | File changes during capture; unchanged pathname later has different bytes or is missing/unreadable. | Source changed/missing/unverifiable explicit; no current bytes attached to historical judgment; D/G. |
| SM-25 | Systematic search with misleading vocabulary and no lexical overlap. | Every eligible window attempted unless explicit interruption/limit; no hidden relevance gate; E. |
| SM-26 | Discovery reaches a qualifying-evidence target; sparse/no-hit scans hit scope or resource limits; relevant passages follow irrelevant runs. | Discovery owns scanning; relevance yields never lower thresholds or pad weak hits. Forced handoffs may have few/no hits with failures/insufficient context separate. Declining relevance alone does not stop scanning. Scheduled-ahead work drains with all outcomes/charges retained; reason, remaining work and continuation eligibility explicit, not answer sufficiency; F; immutable creation stopPolicy, per-invocation default target5/range1–100, settled eight-item checks/overshoot≤7 and direct discovery tests. |
| SM-27 | After a relevance yield, the LLM reads/re-filters, stops, requests more retained work or changes query/directory scope. | Views alone never resume; explicit continuation progresses without repeated successes/refunds under authorization/lifetime/budget limits. Scope/query changes create new searches, not mutations of frozen captures. Exhausted scope and hard limits remain distinct from relevance yields. F reuses semantic-v1/creation policy, counts overlapping evidence IDs distinctly, permits any valid target replacement, and defaults to latest new_matches with cumulative matches/diagnostic all. Compare useful hits/handoff, actual LLM turns, total cost, latency and task success against E; offline proxies do not replace separately authorized live work; C/F. |
| SM-28 | Initial/expanded failure and insufficient context after expansion. | Separate outcome/obligation partitions; processing can complete with failures/unresolved; G. |
| SM-29 | Verified insufficient passage expands once; below-cutoff/raw-negative/record failures try to expand. | Only eligible file expands; +32 lines each side, <=128 lines/16KiB; no cross-file or second widening; G. |
| SM-30 | Expansion budget exhausted before dispatch; retry transient expansion failure; changed file before retry. | Pending obligation before dispatch; frozen same expansion input and lifetime cap; freshness required, no new wider evidence; G. |
| SM-31 | Snippet line larger than selected output bound, multi-item response exceeds cap, repeated-line/Unicode anchors. | Explicit truncation/output_limit, no partial-line misrepresentation; N#HH golden compatibility and independent strong hashes; G. |
| SM-32 | Model supplies fabricated paths, source text or errors containing secrets. | Locations remain deterministic; structural errors sanitized; no raw diagnostics/ledger leakage; C/G/I. |
| SM-33 | Every tool envelope and success/partial/error/example is checked against declared output schema through actual Pi/codemode. | StructuredContent/isError/usage integration, no prose parsing; C/I. |
| SM-34 | Generic-only, semantic-only and combined families plus two physical library copies. | Independent family control, shared execution, inert library import and no filesystem dependency in core; I. |
| EV-01 | Corpus manifests and 36 task slots instantiated, hashes/labels independently verified and split leakage audited. | No synthetic substitution or invented snapshot/ground truth; H. |
| EV-02 | Tuning policy frozen before held-out results; gate failure triggers remediation/new untouched set. | No held-out tuning or relaxed post-result gate; H. |
| EV-03 | Managed/native paired workloads include interruption, reuse, concurrent budget and failures under equal inputs/model/bounds. | Actual preservation, zero-call reuse and measured operational advantage, no weakened baseline; H. |
| EV-04 | Systematic/discovery/record variants versus fair frontier/literal baselines, including downstream investigation. | All declared tasks counted, scope/coverage/duplicates/unknowns disclosed; H. |
| EV-05 | Sample minima, quality, discovery, token, latency/success, three-run integrity gates checked with raw denominators. | Real gate-by-gate evidence or fail/unverified, not generic-test substitution; H/I. |
| EV-06 | Missing authorization/credentials/prices or unavailable exact model. | No live call/fallback without authorization; report not run/known+unknown, never fake zero-cost or passed evaluation; H. |

## Goal-B traceability

| Required handoff subject | Contract / pilot section | Cases |
| --- | --- | --- |
| Shared rubric and three outcomes | Contract 2 | SM-01/02/05, EV-04 |
| Evidence/provenance schemas | Contract 3/5 | SM-03/04/21/24/32 |
| Raw answers and cutoff policy identity | Contract 2/3/5 | SM-06/08/27 |
| Names, closed schemas, paging/continuation | Contract 4/5/9 | SM-07/08/14/15/33 |
| Discovery/systematic coverage | Contract 5/6/7 | SM-09/23/25/26/27/28 |
| One bounded same-file expansion | Contract 8 | SM-04/12/29/30 |
| Parent cancellation and accounting | Contract 6 | SM-10/11/13/14 |
| Discovery/exclusion/non-Git policy | Contract 7 | SM-16–24 |
| Experimental window/scope/output bounds | Contract 3/4/5/7/8 | SM-15/22/23/31 |
| Pilot tasks, labels, splits, baselines, metrics, gates | Pilot 2–9 | EV-01–06 |

Baseline coverage: package/shared-owner constraints map to SM-05/10/13/34; capabilities/composition to SM-06–09/25–27/33; evidence/cutoffs to SM-01–04/21/24/28–32; structured results/hashlines to SM-08/31/33; filesystem safety to SM-16–24; authorization/budgets/lifetimes to SM-07/10–15/34; evaluation to EV-01–06. Deferred persistence/Pi Durable remain non-goals, not missing initial tasks.

## Documentation review procedure

Phase B's review is a document consistency check, not execution of the cases above. Walk a record from preparation through one-attempt partial completion, paging, re-filtering, continuation and expiry; walk a Git scope through exclusion/partial enumeration, systemic scan and discovery early-stop; walk a verified insufficient result through one expansion and a changed-file failure. Balance initial versus expanded counts and parent versus session charges. Verify every error has a safe next step and that no derived view calls a model.

For pilot review, trace one task from manifest and independent source label through tuning freeze, authorized paired runs, downstream token/cost accounting and a failed gate. Verify absent ground truth and unknown pricing remain explicit. Record whether the reader review was same-agent or independently delegated; neither status by itself proves runtime/semantic correctness. Phase B verification results are maintained in the [goal progress record](goal-progress.md).
