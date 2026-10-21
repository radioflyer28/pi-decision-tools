# Phase E verification evidence

The existing filename is retained for stable links. Earlier red/green/mutation results below are historical evidence, not a requirement for subsequent work.

## Protocol and baseline

User confirmed tools + runtime + host seams. Tests observe semantic execution/results APIs, registered envelopes, actual Pi/QuickJS/lifecycle and installed package behavior, using real temporary files/session/coordinator machinery and fake external providers. The user removed the mandatory red–green–red requirement. Test-first development and deliberate regression mutations are optional; subsequent work requires appropriate tests, actual verification results and resolution of discovered bugs, not a prescribed test sequence. Existing tests and historical evidence are retained. Full acceptance verification remains required.

- Baseline bg-13: npm run typecheck; npm test (clean build) exited0;244 tests/34 files passed on Windows before Phase E implementation. This is prior regression coverage, not search implementation proof.
- Remaining OpenSpec tasks remain unchecked until their full acceptance scope is proven. No live calls or publication are authorized.

## Slice evidence

Recorded below as commands finish; no predicted results.

### S1 — owned file-search preparation (part of2.1)

- RED: node scripts/test.mjs filesystem-search exited1, assertion required a search runtime operation but observed undefined (1 failed test).
- GREEN: npm run build; focused search test1/1; existing semantic regression55/55 across9 files passed. One real non-Git capture exposes exact hello SHA-256, original file/range, pending coverage and sensitive/user exclusions without calls/charges.
- SECOND RED: deliberately omitted the configured user exclusions from capturer construction; clean build succeeded, test exited1 with pending/total2 instead of1. This was a behavioral assertion, not compilation failure.
- Restored the exclusion argument immediately. Restoration verification follows. Task2.1 remains incomplete pending full input validation and tool/host registration; later lifecycle, coverage, freshness and long-search tasks are not claimed implemented.

- S1 restoration: clean build and focused test1/1 passed.

### S2 — explicit capture-limit coverage (part of4.1)

- RED: real257-file temporary Git scope produced stopReason prepared instead of scope_limit (test exit1).
- GREEN: derive the visible stop from capture when preparation/execution otherwise says prepared/complete; focused2/2 passed.
- A first candidate mutant removed TypeScript's summary narrowing and failed compilation; it was restored and **does not count** as sensitivity evidence.
- SECOND RED: the compiling mutant omitted the prepared capture-limit branch; test reproduced prepared versus scope_limit (exit1, other test passed). Restored in finally; clean build and focused2/2 passed. No mutant remains.

### S3 — acquisition lifecycle drain (part of2.3)

- RED: real source-read race hook was not connected; acquisition finished instead of exposing the controlled read boundary (exit1).
- GREEN: source hooks reach the actual capture boundary, acquisition registers with invocation cancellation/drain before awaiting, post-await admission rechecks generation/gates, and pending capture slots count toward parent admission. Focused3/3 and semantic55/55 passed.
- SECOND RED: compiling mutant omitted acquisition from the drain map; disable returned while the controlled source read remained blocked, triggering the exact drain assertion (exit1). Finally-restored source; clean build and focused3/3 passed.

### S4 — more than32 child batches (part of3.4)

- RED: a real one-file272-window search stopped with workspace_full at the live-batch cap (exit1). This is an observed runtime bug, not only a design concern.
- GREEN: search-only retirement preserves copied raw outcomes, aggregate usage/diagnostics and child extents before releasing settled nonretryable core batches. Retryable children remain live; record children preserve their existing bounded reuse behavior. bg-14 clean build, focused4/4 and existing semantic55/55 passed.
- SECOND RED: removed only the retirement call; clean build succeeded, the272-window test reproduced workspace_full (exit1; other3 tests passed). Restored in finally; clean build and focused4/4 passed. Test verifies all272 unique judgments,272 charges and2720 native tokens through paged results. No mutant remains.

### S5 — owned current-file checks and read leases (part of4.3)

- RED: `filesystem-search-evidence` observed freshness `captured` rather than `changed` after a real file edit (exit1).
- GREEN: current checks use the owned capture without replacing text/hash or spending; parent read leases reject concurrent continuation/release and participate in expiry drain. Clean build, evidence1/1 and semantic55/55 passed; added real blocked-read expiry test then evidence2/2 passed.
- SECOND RED: a compiling mutant returned `unchanged` after the real check and failed the changed assertion; a separate compiling mutant omitted evidence-drain and expiry rejected with `search_busy`. Both restored in finally; clean build and evidence2/2 passed. No mutant remains.

### S6 — actual Pi/QuickJS public search (parts of2.1/5.1)

- RED: actual host test asserted missing `semantic_search` registration (exit1; five existing host tests passed).
- GREEN: eight tool definitions, trusted `ctx.cwd` and copied configuration exclusions survive owner setup/navigation; actual QuickJS prepares/executes/continues/views/checks owned evidence with one nested usage boundary. Fixed a test harness permission gap with the same narrow ancestor `.git` grants used for filesystem tests, and updated old seven-tool assertions. Host6/6, extension22/22 and generic host1/1 passed.
- SECOND RED: a compiling lifecycle mutant dropped user exclusions; real host search failed its coverage assertion. Finally restored; clean build and semantic56/56 passed.

### S7 — bounded exclusion details (part of4.2)

- RED:100 long excluded paths returned `output_limit` instead of a usable page.
- GREEN: remove optional detail entries only as needed, retaining complete reason totals and a truthful truncation flag; frozen captures remain unchanged. Clean build and results1/1 passed.
- SECOND RED: compiling mutant disabled detail trimming and reproduced `output_limit`. Finally restored; clean build and results1/1 passed.

### S8 — monotonic acquisition/execution deadline (part of3.3), retained retries (3.2/3.4)

- RED: the new capture-plus-two-child fake-clock test made nine calls but reported `cancelled` rather than `deadline`. The owned acquisition signal was being flattened to external cancellation by a nested scope.
- GREEN: pass only the internal owned scope to execution's stop projection and refine cancellation from its trusted reason; caller-provided signal reasons remain untrusted. Clean build, search-execution6/6 and actual host6/6 passed.
- SECOND RED: compiling mutant omitted the owned scope and reproduced cancelled versus deadline. An additional compiling retirement mutant released retryable children and the lifetime-retry test failed at1 rather than2 attempts. Both restored in finally; clean build, execution6/6 and semantic56/56 passed.
- The six execution cases also directly verify ten-window/eight-request partial progress, no vocabulary prefilter, canonical source ranges and exact semantic-v1 state, retained source continuation, atomic mixed retries, lifetime ceilings, unknown liability, exact input units across children, model change without fallback and concurrent generic allowance/scheduler sharing.
- Additional snippet tests verify original BOM/CRLF/Unicode byte hashes, bounded line offsets and unchanged historical text. A test initially expected invalid UTF-8 current bytes to be unverifiable; corrected that assumption: safe raw-byte capture can truthfully detect a changed hash without decoding. An actual directory replacement verifies unverifiable. This was not a runtime defect or counted TDD red.

### Intermediate acceptance

- bg-16: typecheck, clean build and full isolated Windows suite **252/252 in37 files**, exit0. This predates the additional five search-contract tests, which independently passed5/5 (closed future fields/limits, full256×4096-byte scope, authorization before reads, preparation before conversation but no dispatch without persistence).
- bg-17: offline installed-artifact verification passed with eight tools, all four family inventories, public search preparation/partial/continue/cutoff/historical freshness/release, generic/record regressions, inert exports/types and unbundled peers. Temporary artifact122 files/800909 bytes, sha512-qElle/V/yItjXqLcDiuk6v1r3xbEnusaCeILVwNrCxT1Amq0fIXHDXsXBjxQvG0UDHQjlg4KyxXJq4bRYtodXA==; removed, not published. Task5.2 checked.

## Current scope of proof

Only tasks1.1/5.2 are fully checked. Runtime/host search, owned freshness/read leases and bounded exclusions now exist. Broader continuation/budget/retry/lifecycle/resource/platform verification, complete byte/snippet and coverage cases, docs/security reconciliation and sync/archive remain unfinished. The family matrix is being strengthened to actually prepare searches in both enabled configurations and deny both hidden write tools. No deliberately broken runtime code remains.


## Resumed acceptance (goal0b2e7b81-e2bf-48ef-952a-845eccc8ccd1)

Mandatory red–green–red was removed by the user; ordinary behavioral verification remains required.

- Acquisition audit added pre-aborted admission and root-acquisition deadline cases. Both initially failed (four metadata checks after pre-abort; deadline flattened to cancellation), then passed after the early guard and owned-reason translation. Eight concurrent pending captures also drain without late admission. These source changes were restored after historical sensitivity checks.
- Earlier bg-18 exposed test wall-clock assumptions, not a relaxed runtime ceiling:257-file fixture now requests60s, and the272-window acceptance uses bounded64-request continuations, retaining272 unique judgments/charges and2720 tokens. bg-19's fake responses omitted required api; corrected fixtures, not production response validation.
- bg-20 passed64 Linux tests and offline eight-tool installed artifact checks. Later actual-host lifecycle coverage passed7/7 after correcting the helper's session alias to manager. Real compaction, disabled views, real branch navigation, root/exclusion retention and all-branch charges are exercised.
- bg-21 passed typecheck/build and280 Windows tests/41 files. Linux then reported source_unverifiable in four non-Git result fixtures while both Git fixtures passed. Ancestor metadata inspection found no Git markers; temporary diagnostics were removed. The same targeted Linux result file subsequently passed6/6 three consecutive times without relaxing source verification. A fresh full platform run is required; the failed run is not final acceptance.
- Final lifecycle audit reproduced caller and disable cancellation being ignored by current-file checks despite correct lease drain. Added explicit normalized caller/disable abort propagation through wrapper/results/parent lease/capture, preserving expiry precedence and disabled historical readability. Clean build and evidence6/6 passed. No diagnostic instrumentation or intentional mutant remains.
- New docs/search-usage.md and search-verification.md provide parser-checked examples, requirement/SM mapping and same-agent security review. Live relevance quality, savings and publication remain unclaimed.

- bg-22 passed typecheck/build and281/282 Windows tests, but the caller-cancellation fixture failed with a Windows metadata-worker unverifiable error after148s. No safety timeout or verification policy was relaxed. bg-23 immediately rechecked evidence6/6, then passed all71 Linux filesystem/search tests (13 files, Node24.14.0) and the offline installed eight-tool artifact (124 files/820741 bytes; sha512-1rtqs5GRA6p+2wuj+93EHN45TYkDUSN2k4hTi4rmlFlO166j+zqlxd5ogXcUqNhe4zj97G64kcqtGddIkaadyQ==). A fresh full Windows gate remains required rather than combining partial passes into a claimed full run.

- Resumed under Goal7a942b12-a47e-4ba2-80d6-ebc488fa4335. bg-24 again passed281/282 Windows cases, this time failing the pre-existing SM-24 filesystem freshness fixture with unverifiable after400s; all Phase E search and host files passed. No guard was weakened. A read-only Windows System-log query on2026-10-16 found Kernel-Power suspend/resume events and Power-Troubleshooter resume events. This establishes recent machine suspension, not a proven causal attribution for each failure. A new complete run is required after resumption.

## Final acceptance before synchronization

bg-25 completed with exit0: fresh typecheck, clean build, **282/282 Windows tests across41 files**, and strict change validation. Every filesystem, search, generic/record regression, actual-host/family/copy and documentation suite passed in that single complete run. A subsequent documentation-only run passed6/6. Together with bg-23's71/71 actual Linux tests and offline installed-artifact gate, this satisfies the implementation acceptance matrix in docs/search-verification.md. All17 tasks are reconciled. No source or test behavior was relaxed to obtain this result; earlier failed runs remain above. Next: inline four-delta synchronization, strict main-spec validation, exact preservation comparison, archive and postarchive checks.

## Synchronization verified

On2026-10-16, all four deltas were applied inline after acceptance. Exact comparison verified all eight new systematic-search requirements and each of the three modified requirements; existing Purposes and unrelated requirement/scenario content were preserved. The three wholly unaffected main-spec files retained their SHA-256 hashes. All seven main specs and the change passed strict validation (only informational long-requirement notices). The apply CLI reports17 complete/0 remaining and all_done. Archive will use --skip-specs only to avoid a redundant second merge of these already-verified specs, not to skip synchronization.
