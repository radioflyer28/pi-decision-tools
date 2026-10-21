# Pilot and release-evidence plan

## 1. Status, reader and decision

**Plan only, 2026-10-15. No live pilot, labels, source snapshot acquisition or measured quality results are supplied by this document.** The reader is the phase-H evaluator, who must be able to construct a leakage-controlled, authorized experiment and determine pass/fail/unverified without inventing a benchmark after seeing results.

Use the [semantic contract](semantic-contract.md), [acceptance matrix](semantic-acceptance.md), [generic acceptance requirements](managed-execution-acceptance.md) and [full goal](../goal.md). These targets are agent-selected under delegated technical planning authority, not individually user-approved numerical claims. The product assists investigation, never autonomous editing or proof of whole-program behavior. All current defaults are experimental. A deterministic test pass is not a live evaluation pass.

## 2. Population and immutable manifests

Initial population: bounded source-investigation and caller-record-filtering tasks in TypeScript, Python, Go and JavaScript, with behavioral paraphrases, lexical distractors, negative queries, context boundaries and ambiguous dependencies. Sample one tuning repository and three disjoint held-out repositories. This deliberately tests cross-source/language transfer and must be reported as such, not representative of all repositories.

Tuning source: this project's generic execution slice at an explicitly captured content manifest. Treat it as private until the operator authorizes transmission. Held-out acquisition targets: CPython release v3.13.0 (`Lib/pathlib`), Go release go1.24.0 (`src/io/fs`) and Node release v22.19.0 (`lib/internal/fs`). These names are proposed acquisition references, **not inspected immutable snapshots**. Resolve and record actual commit IDs and file hashes before labeling. If a target path/version is absent, stop to reconcile the corpus plan before running; do not silently substitute a convenient repository. Respect licenses and retain acquisition provenance. Do not use installed vendor benchmarks as task labels or accuracy evidence.

Each corpus manifest records: datasetVersion, split, source name/reference, resolved revision, license, acquisition date, root content SHA-256 inventory, included paths, excluded paths/reasons, eligible line/window counts, preparation version, contamination review, permissions and status. Each task records: taskId, split, sourceManifestHash, predicate, exact scope, task family, language, allowed context, record-variant definition if any, annotation records, review/adjudication identities, frozenLabelHash and status. Unknown values are null with status pending, never a fabricated hash, commit, label or approval.

No corpus source or derived record may cross tuning/held-out. No shared near-duplicate modules, copied fixtures or source-version variants across splits. Assign before judgments; freeze manifests/labels before tuning execution, keeping held-out annotations sealed from the tuning process. Dataset staff may inspect held-out source to label it, but cannot feed its answers, model performance or preferred thresholds to tuning. Source review is not permission to transmit source.

### Concrete realistic task slots

These are predicates to instantiate and annotate, not assertions that the selected source contains a match. Two negative-intent slots per held-out source must be confirmed by annotation; if not genuinely negative, add fresh tasks before evaluation to meet minima rather than relabeling facts. A missing matching implementation may be a real no-match, not a reason to cherry-pick a more favorable query.

| ID | Source/split | Investigation predicate |
| --- | --- | --- |
| T01 | toolkit/tune | Processing is refused until the conversation is actually persisted. |
| T02 | toolkit/tune | A reservation is recorded before external work starts. |
| T03 | toolkit/tune | Earlier-branch navigation cannot restore spent allowance. |
| T04 | toolkit/tune | Separate package copies discover one execution owner. |
| T05 | toolkit/tune | Automatic retry depends on structured transient status, not error prose. |
| T06 | toolkit/tune | A completed answer is not invoked again on continuation. |
| T07 | toolkit/tune | Model selection changes stop differently pinned unfinished work. |
| T08 | toolkit/tune | Cancellation does not free concurrency while a provider still runs. |
| T09 | toolkit/tune | Native answer shape and identity are checked before reuse. |
| T10 | toolkit/tune | Source text is written into a persistent resumable batch cache. (negative-intent) |
| T11 | toolkit/tune | Native classifier calls fall back automatically to a frontier model. (negative-intent) |
| T12 | toolkit/tune | An idle workspace is explicitly released without refunding spending. |
| P01 | CPython/held-out | Path components are combined while preserving platform path semantics. |
| P02 | CPython/held-out | Recursive traversal changes behavior for symbolic links. |
| P03 | CPython/held-out | A missing path is distinguished from an inaccessible path. |
| P04 | CPython/held-out | Parent creation is controlled separately from final-directory creation. |
| P05 | CPython/held-out | Name-pattern matching behaves differently for recursive patterns. |
| P06 | CPython/held-out | A path operation delegates its critical behavior to an unseen helper. |
| P07 | CPython/held-out | This module itself checks file ownership before every deletion. (negative-intent) |
| P08 | CPython/held-out | Remote HTTP requests are retried with exponential backoff here. (negative-intent) |
| G01 | Go/held-out | A filesystem path must be clean and relative before access. |
| G02 | Go/held-out | Traversal distinguishes skipping one directory from stopping the entire walk. |
| G03 | Go/held-out | Directory entries are visited in deterministic sorted order. |
| G04 | Go/held-out | An optimized interface is used when the filesystem implements it. |
| G05 | Go/held-out | A read error is wrapped with operation and path context. |
| G06 | Go/held-out | Matching or walking depends on behavior supplied by an external filesystem. |
| G07 | Go/held-out | File contents are cryptographically verified before every read. (negative-intent) |
| G08 | Go/held-out | A remote authentication token is refreshed before retrying access. (negative-intent) |
| N01 | Node/held-out | A file operation handles cancellation before or during asynchronous work. |
| N02 | Node/held-out | Invalid file-operation options are rejected before dispatch. |
| N03 | Node/held-out | Resources are closed after either success or failure. |
| N04 | Node/held-out | Recursive copying makes an explicit symbolic-link decision. |
| N05 | Node/held-out | An operation translates a native failure into a path-associated error. |
| N06 | Node/held-out | Completion depends on a native binding whose behavior is not visible locally. |
| N07 | Node/held-out | Every file write requires an application user's role-based approval here. (negative-intent) |
| N08 | Node/held-out | File contents are uploaded to a remote backup service automatically. (negative-intent) |

Scope each task before evaluation to relevant bounded modules, not only already-known positive lines. Preserve realistic irrelevant neighbors and lexical distractors. Include boundary-spanning positives where the selected version supports them; do not manufacture them and call them realistic. Record absent strata and add untouched tasks before the freeze if needed.

For record filtering, derive fixed caller records from T05/T06 and at least P03/G02/N01/N03: ordinary grep snippets, selected diffs between independently pinned public versions, or actual disclosed test/log excerpts if available. Keep record boundaries and omissions as they would appear to a caller. These variants belong to their source task/split, do not increase the independent task sample count, and have separate per-record labels. A synthetic log invented for convenience belongs only to the supplemental set.

Supplemental fixtures include adversarial instructions, misleading comments, malformed native answers, wrong model identity, missing credentials, provider failure, budget exhaustion, ignored abort, stale files, CRLF/LF/Unicode, overlong lines and snippets, and expansion across a window boundary. Their deterministic expected side effects are not evidence of realistic classifier precision/recall.

## 3. Annotation and adjudication

Two reviewers independently inspect the declared scope and permissible supporting context, enumerate minimal relevant spans and label each relevant/negative/ambiguous unit using semantic-v1. Record source hash/range, label, rationale, missing dependencies and supporting evidence. Reviewers do not see candidate classifier output while producing labels. Reconcile disagreements explicitly; unresolved ambiguity remains insufficient-context rather than being forced positive or negative.

Agent suggestions or two agreeing models alone are not ground truth. Require human review or independently executable evidence validating adjudicated labels, plus source-grounded reasoning. An executable check must actually demonstrate the predicate and identify the supporting source span; compiling the repository or a model generating a passing assertion is insufficient. Record reviewer/adjudicator identity and evidence. Without these checks the quality gate remains unverified.

Illustrative annotation rubric (synthetic, not dataset labels): a bounded `for` loop around a transient-error condition can support a retry-bound match; a complete immediate-throw function is a local no-match; an unseen retry helper is insufficient-context. A comment asserting “always safe” does not prove the behavior. A no-match task requires reviewing the complete declared scope, not just finding no literal query words.

Define a positive unit as a minimal contiguous source span sufficient for the local predicate; split independent implementations into separate units. Multi-span behavior requiring unavailable cross-file synthesis remains ambiguous. A returned captured/expanded range covers a gold positive only when it contains the complete minimal span; mere one-line overlap does not count. Review obviously overbroad returned ranges under the fixed window bounds. For recall, count each fully contained gold unit once even if one window covers several units. For precision, map each accepted range to the ordered set of gold units it fully contains; ranges with the same nonempty set form one supported prediction group. Repeated overlapping ranges in that group are duplicates, not extra true positives; report every duplicate's token/reading cost. Unsupported ranges are false-positive groups deduplicated only by exact path/range/hash. This prevents repeated windows from inflating precision without discarding genuine multi-unit coverage. Preserve raw range-level precision as a supplementary metric.

For records, use exact record IDs for confusion matrices; the gold label considers only the supplied record, not hidden source context. Unverified provenance cannot change that label's admissible evidence. Keep gold ambiguity counts separate from actual positive/negative units and report how it affects decision coverage.

## 4. Freeze and tuning

Before any candidate evaluation, freeze versioned source/label manifests, task prompts, baseline procedures, metrics, sample minima and gates. Baseline/tool access exclusions are equal. Freeze the numerical gate values below before held-out outcomes exist.

Tune only on T01–T12 and their record variants. Compare the four proposed cutoffs while holding model/rubric/windows fixed; results re-filtering itself must make zero calls. If changing rubric/window preparation is necessary, version it and rerun tuning, not held-out. Select the lowest cutoff meeting tuning precision >=0.80 that maximizes recall; ties choose the lower unresolved fraction, then lower cutoff. If no candidate meets that criterion, report failed tuning and propose bounded remediation rather than selecting a held-out winner.

Freeze the selected model identity/configuration, rubric, preparation, policy, dependency versions and task protocol before the held-out evaluator opens results. Mutable provider aliases limit exact backend reproduction; record that uncertainty. Held-out failure permits remediation only with a new untouched held-out sample. Never relabel correct ground truth, shrink scope, remove difficult tasks or move gates to force a pass. Clearly distinguish genuine annotation corrections independently adjudicated without candidate-score targeting.

## 5. Paired baselines and run protocol

### Managed versus native

Use identical identified JSON states/questions and the same exact available classifier. Native baseline is a straightforward codemode script with bounded concurrency and explicit request/input/work ceilings. Preserve successful answers in memory across script steps where the baseline naturally can; disclose bookkeeping code and its limitations. Do not deliberately throw successes away or omit easy controls just to make the managed wrapper look useful.

Paired scenarios: initial batch; interrupt after a fixed completed subset then resume; submit eligible identical work again; concurrent generic/semantic/library callers under one budget; transient failure and explicit failed-item retry. Run deterministic fake-provider side-effect assertions separately from authorized live runs. Capture actual requests/bytes, duplicate successful invocations, preserved outcomes, manual script bookkeeping/recovery actions, context-visible bytes/tokens, elapsed time, known cost and unknown usage. The baseline is not claimed to have toolkit-wide ledger enforcement merely because one script checks a counter.

Required managed operational outcomes: preserve successes without default repetition; zero provider calls for eligible same-generation reuse; no shared-limit violations; no loss of completed answers versus paired native runs. At least one measured advantage must be demonstrated: fewer duplicate provider calls on a prescribed recovery/reuse scenario, less frontier-visible recovery data, or fewer explicit recovery/bookkeeping steps under the fixed script protocol. If a well-written native baseline ties every metric, report the absence of demonstrated added utility instead of inventing a benefit.

### Semantic versus ordinary frontier search

Baseline frontier agent uses read/grep and ordinary available navigation within the same immutable scope, excludes the same sensitive/generated files and cannot call semantic tools. Candidate uses the same frontier model/task prompt, plus the semantic tools with the frozen classifier/policy. Both may perform follow-up reading inside the same declared scope; count it all. They return supporting source spans and a bounded investigation answer, including no-match/unresolved where appropriate. A separately logged literal/regex retrieval reference shows whether semantic judgment adds value beyond trivial search; it is not a substitute for the ordinary frontier baseline.

Use one fixed investigation prompt per task: find source evidence for the predicate, report captured locations, distinguish uncertainty and no-match, do not edit or execute source, obey the declared scope and limits. Tool availability, token/time/request ceilings and baseline script versions are recorded. Do not grant the candidate access to labels or privileged source context. Submitting a classifier-only answer is not equivalent to completing the downstream frontier investigation.

Run three paired repetitions per live condition in fresh runtimes/sessions with the same finite budgets, using alternating baseline/candidate order across repetitions. Warm/cache state must be disclosed; eligible within-run reuse is part of the managed scenario, accidental cross-run reuse is not. Record network/provider failures rather than selectively rerunning favorable repetitions. Apply only the frozen retry policy; report incomplete runs and their charged usage. Never spawn unbounded parallel baseline agents or treat their spend as free.

## 6. Metrics and arithmetic

All measurements attach task/run/model/rubric/preparation/policy/source/label identities. Report aggregate and per-source/per-family results, raw counts, denominators, task-level distributions and failure/unresolved coverage.

- Systematic recall = distinct gold positive spans fully returned as accepted matches / all gold positive spans in the declared eligible scope. Unresolved positives are misses. Also report end-to-end recall against annotated declared-scope positives, including any excluded by preparation; scope exclusions cannot disappear from the report.
- Precision = distinct correctly supported accepted prediction units / distinct accepted prediction units after the fixed supported-set grouping. Report duplicates and evidence inflation separately. Zero accepted predictions gives precision undefined, not 1; positive tasks with zero matches have recall 0.
- Unresolved fraction = final unresolved / all initial judged evidence units, with failed/pending separately reported. A zero judged denominator is unverified. Also report a task-weighted unresolved fraction so a huge file cannot hide poor small-task behavior.
- Record variants use per-record positive precision/recall and the three-way confusion matrix. Report them separately; do not pool record duplicates into source-span counts. Operational failures are not semantic no-matches.
- Discovery usefulness = positive tasks with at least one gold match in the first five accepted unique evidence IDs / all positive tasks. No-match rejection = genuine negative tasks with zero accepted matches / all genuine negative tasks. Include early stop, unexamined scope and failed/partial tasks in denominators.
- Frontier-visible evidence tokens include every tool payload/snippet and downstream read actually delivered to the frontier, including repeat reads and unresolved investigation. Count with a named tokenizer/version; report UTF-8 bytes separately. Report total frontier native input/output usage too, but do not pretend attribution is exact when unavailable.
- Latency covers discovery, preparation, queues, retries, drain, paging and downstream investigation to final answer; report median/p95 and per-task regressions. Task success is independently judged against source-grounded labels, not self-reported confidence.
- Cost is the sum of known classifier and frontier charges, retries, downstream work and other billable retrieval if used. Preserve unknown attempt/pricing counts. Do not multiply token counts by guessed prices or treat zero catalog prices as known free work.

Report micro and macro metrics and 95% Wilson intervals for binary proportions with z=1.96. For ratio p=x/n, Wilson center is `(p+z²/(2n))/(1+z²/n)` and half-width is `z*sqrt(p*(1-p)/n+z²/(4n²))/(1+z²/n)`. Source/task correlation means span intervals are descriptive, not independent-sample certainty; also report per-task distributions. Three repeats do not triple the number of independent labeled tasks/spans.

Illustrative arithmetic, **not measurements**: 90 of 100 gold spans recovered in 90 distinct supported prediction groups, plus 10 false-positive groups, yields recall 0.90 and precision 0.90. If five more positives are unresolved rather than returned, recall is 0.85, not 90/95. Twenty unresolved among 100 judged gives 0.20; ten pending are reported separately and cannot be called ten no-matches. A candidate with 3,000 total evidence tokens versus baseline 4,000 has ratio 0.75; another 1,000 downstream tokens changes the ratio to 1.0 and fails the context gate. Known cost $0.04 plus two unpriced attempts is “$0.04 known + 2 unknown,” not total $0.04.

## 7. Release gates

Every row is currently **unverified/not run**. Apply gates per frozen model/configuration; do not borrow one model's result for another.

| Gate | Required evidence |
| --- | --- |
| Safety/mechanics | All deterministic safety, provenance, coverage-partition, budget, lifecycle, schema and zero-call re-filtering cases pass; no safety error averaged away. |
| Sample adequacy | All 24 realistic held-out tasks; >=8 per held-out source; >=100 adjudicated positive spans and >=6 genuine no-match tasks. Add untouched tasks before running if needed; never pass an inadequate sample. |
| Systematic quality | Held-out span recall >=0.90, precision >=0.80, each source recall >=0.80, unresolved fraction <=0.25. Publish micro/macro/counts/intervals and record-variant metrics. |
| Discovery | Usefulness within five results >=0.80 of positive tasks; no-match rejection >=0.80 of genuine negative tasks. Unexamined work explicit. |
| Context utility | Median paired ratio of total frontier-visible evidence tokens <=0.75, including downstream reading. Zero baseline tokens makes ratio undefined; report and do not use it to manufacture savings. |
| Time and success | Median paired end-to-end latency ratio <=2.0; task success rate not below baseline. Publish p95 and regressions. |
| Generic utility | Required preservation/reuse/shared-budget outcomes and >=1 measured operational advantage over the fair native baseline, without lost completed answers. |
| Repetition/report integrity | Three runs per paired live condition; frozen versions; known costs plus unknown counts; all exclusions, incomplete runs and scope differences disclosed. |

Quality/context/latency targets are point-estimate pilot gates with uncertainty, not universal production guarantees. Unknown prices do not automatically fail a nonexistent cost-saving gate; they prohibit complete-cost or cost-improvement claims. Missing required metrics, labels, approvals or adequate sample counts do prevent declaring this pilot passed. The initial package is not fully delivered until the required evaluation evidence exists.

Smallest falsification: tuning-only T05 paraphrase, an annotated lexical near-match and a split-context example. If no permitted cutoff yields useful retained evidence without excessive downstream reading, remediate the rubric/preparation before spending on the full pilot. This does not replace held-out gates.

## 8. Authorization, retention and rollout

Before live work, generate a dry-run manifest with exact classifier/frontier provider/model identities, configuration fingerprints, disclosed source roots/record contents, frozen task counts, upper-bound windows, possible single expansions, retries, logical input-byte bounds, concurrency and work ceilings, and worst-case spend where pricing is known. A conservative classifier request bound is `3 * conditions * (initialWindows + expansionEligibleWindows) * (1 + maxRetries)`; enumerate each condition and avoid counting repeated cached calls as guaranteed free. Bound frontier iterations/tokens separately. Include private-source consent explicitly. These are proposed bounds, not grants.

Ask for separate explicit operator authorization of those sources and finite ceilings. Check available credentials without acquiring or printing them. No default model, public repository, user permission to author docs, or generic enablement implicitly authorizes the evaluation campaign. If requested model is unavailable, stop without fallback. Do not manufacture a persisted conversation to bypass the real execution gate.

Store evaluation artifacts only as explicitly authorized: immutable manifests, ground-truth provenance, run settings, sanitized observations and reports. Source-bearing labels/snippets require approved retention/location/access. Do not put private content or provider errors into routine toolkit logs. Note that Pi tool arguments/results may be saved in the normal transcript. No runtime cache/checkpoint persistence is introduced by evaluator artifacts.

Maintainers own annotation adjudication and release decisions. Rollout: offline deterministic checks → separately authorized pilot → limited explicit opt-in after passing gates. Disable semantic-family execution on safety failures or unexplained drift; retain generic capability and all ledger liability. New model/rubric/preparation versions require re-evaluation. A failed gate leads to a bounded remediation proposal, not a moved threshold or a silent switch to frontier-model classification. Ordinary frontier investigation remains the user's explicit fallback, not an autonomous retry chain.

## 9. Required report

The final report must include manifest/label hashes and provenance, authorization scope, software/model versions, all paired raw counts and uncertainty, per-source/record-variant results, known costs/unknowns, token/reading attribution limitations, stop/coverage reasons, gate-by-gate pass/fail/unverified and remediation status. A missing credential or live run is reported not run. Synthetic fixtures, vendor benchmarks and generic package tests cannot fill missing real quality evidence.
