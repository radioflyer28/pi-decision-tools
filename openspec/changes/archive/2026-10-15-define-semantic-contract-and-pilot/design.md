# Design

## Context

See `proposal.md` for motivation and deliverables. This is phase B of `goal.md`, following archived `2026-10-14-implement-managed-generic-batches` (25 tasks). Current source exposes native choice/bool/score answers, model/configuration identities, cumulative accounting, invocation-only usage deltas and generation-scoped workspaces. The current semantic parent is a test fixture, not a product implementation.

Inspection covered the full conceptual baseline, managed execution contract and acceptance matrix, README, generic contracts/coordinator, session owner, semantic-parent fixture, and the relevant managed-batch/toolkit integration main specs. Core submission accepts a trusted semantic consumer and an internal required-model identity. The public library facade intentionally does not expose a second owner or a way to grant authority. Existing parent tests establish enforcement only, not filesystem safety, semantic judgments or search coverage.

Older documents still say no runtime exists, and the progress record contains historical phase-A inventory statements. Correct status using dated annotations; do not silently rewrite the original approved requirements or claim the conceptual baseline itself was a runtime verification report.

## Goals / Non-Goals

**Goals:** Give a fresh contributor a complete, testable documentation handoff, and freeze an evaluation procedure before observing classifier performance. Separate proposed contracts from implemented behavior. Record the choices below as agent decisions made under the user's technical delegation, not as individually user-approved decisions.

**Non-Goals:** No code, new runtime dependencies, behavioral specs, dataset execution, model calls, automatic remediation, new spending authorization or release claim. Phase B completion means reviewed documentation and acceptance traceability, not completed phases C–I.

## Decisions

### 1. Documentation boundary and deliverable structure

Use `skip_specs: true`. Write three documents during apply: semantic contract (normative future interface), acceptance matrix (observable cases with phase owners), pilot plan (frozen procedures and proposed gates). Link each to the baseline and shared execution requirements. Each opens with its evidence status and named reader/post-read action. Do not create a speculative main spec or register tools merely to make this documentation change executable.

Alternative: combine phase B with record filtering. Rejected because evidence, coverage and evaluation decisions affect every subsequent semantic slice and merit review before runtime implementation.

### 2. One bounded semantic question; deterministic policy outside the model

Propose rubric `semantic-v1`: one native choice question with labels `match`, `no_match`, `insufficient_context`. Match requires concrete evidence in the supplied passage that satisfies the predicate; lexical similarity alone is insufficient. No-match requires enough local evidence to judge the predicate unsatisfied. Missing dependencies, ambiguous subject, contradictory evidence or a predicate requiring unobserved behavior produce insufficient-context. Evidence text, including instructions embedded in comments/logs, is never authority. Broad whole-program questions may remain unresolved.

Retain the complete structurally validated native choice answer and model/rubric identity. A derived policy accepts a match only when the raw label is match and its match probability meets `minMatchProbability`. A rejected raw match is unresolved with reason `below_cutoff`, not no-match. Raw insufficient-context remains unresolved regardless of cutoff; provider failure, invalid response and pending work remain separate. Raw no-match remains a negative judgment, not a claim that the repository contains no match.

Initial experimental policy is label-only (`minMatchProbability: 0`), chosen to avoid claiming a calibrated confidence threshold. Tuning may compare 0, 0.5, 0.65 and 0.8 per exact model/rubric/evidence preparation version; none is presumed accurate. The pilot freezes its selected policy before held-out evaluation. Hash the canonical policy separately from execution identity so re-filtering raw answers makes zero provider calls. Changes to predicate/rubric/model/evidence require new execution, not cutoff reuse. Low-confidence matches do not trigger context expansion; only the explicit insufficient-context label is expansion-eligible.

Alternative: bool plus universal 0.5 cutoff or an extra score question. Rejected because bool has no explicit missing-evidence label and no current downstream action needs a second model judgment. Generic batches remain untouched.

### 3. Evidence and provenance

Specify discriminated record/file evidence. Both carry stable runtime evidence ID, captured text SHA-256, preparation version and input identity. Records carry caller ID/text and bounded optional provenance explicitly marked `unverified`; it cannot supply a readable filename or expansion authority. File evidence is created only by deterministic discovery and capture inside the authorized root; it carries relative path, exact inclusive one-based line range, full captured-file SHA-256, passage SHA-256 and root/snapshot identity. IDs are not short hashline anchors.

Preserve exact captured bytes and line-ending distinctions for hashes; decode only valid UTF-8, with an explicit BOM convention, and document newline/range behavior including empty files and trailing newlines. Model state contains the predicate and bounded evidence as data, not filesystem commands. Structured source locations never come from model output. Historical raw evidence is retained ephemerally; current-file reads report freshness separately and cannot silently replace text under an old judgment.

Alternative: trust caller-provided path/range or use N#HH as evidence identity. Rejected because provenance assertions and short hashes cannot grant access or prove snapshot identity.

### 4. Proposed semantic operation surface

Use a shared semantic family, disabled by default until the implementation and explicit family configuration allow it. Keep the public generic library facade unchanged. Define closed JSON inputs/outputs and complete success/error examples in the contract, using these operation names:

| Operation | Proposed purpose and key inputs |
| --- | --- |
| `semantic_filter` | Identified text records, predicate, cutoff policy, optional lower `run` ceilings; omit run to prepare only |
| `semantic_search` | Predicate, root-relative scope, mode systematic/discovery, optional discovery match target, cutoff policy, optional lower run ceilings |
| `semantic_results` | Operation ID, revision cursor, page limit, optional replacement cutoff; no provider calls |
| `semantic_continue` | Operation ID, expected immutable identity, lower run ceilings and optional explicit eligible failed-evidence retry IDs |
| `semantic_evidence` | Operation ID, selected evidence IDs, bounded rendering options and optional current-file freshness check; no model call |

Both submit forms return the same discriminated parent result. It includes operation ID/kind, identity, model, rubric/preparation/policy identities, per-evidence raw/final outcomes, coverage, expansion obligations, stop reason, usage data, ledger totals and independent pagination metadata. Failures use an `ok:false` envelope and available partial results, not a misleading empty match list. Use `search_expired` consistently for old semantic operation handles, including filters; unknown cursor, stale revision and busy parent are explicit errors. Re-filtering changes only the derived view identity/cursor, not the immutable execution identity.

No background job or streaming interface. Cancellation is through the current call signal and existing disable/lifecycle controls. The documentation must define release of an idle semantic workspace without extending the library's grant surface, and distinguish release from cancellation. Propose extending the user-owned `/decisions release` operation to accept semantic handles in its eventual executable change; handle namespaces prevent ambiguity. Do not implement that command change here.

### 5. Scope, coverage and continuation

One passage-scanning engine supports both modes. Systematic ordering is normalized relative-path order then start line, with no query-based relevance gate. Discovery deterministically prioritizes explicitly requested paths before the remaining paths, preserving stable order within each group. It does not use embeddings, query-word filtering or model-derived access. Discovery defaults to a target of five accepted unique evidence IDs, reports early stopping, and never claims exhaustive coverage. Continuation explicitly resumes from the retained frontier rather than repeating completed passages; the contract must specify how a met target may be raised without mutating evidence/model identity.

Expose separate dimensions: enumeration complete, initial passage coverage, expansion processing, unresolved/failure counts and output truncation. Counts of initial eligible passages partition into completed judgments, failed, pending and running; match/no-match/insufficient categories are judgment subclasses, not additional passage counts. Expanded judgments attach to their original passage, not a second discovered passage. Every excluded file/range has a bounded reason record and reason totals. If enumeration or capture stops at a bound, undiscovered totals are unknown, never zero.

Parent `complete` requires fully enumerated declared scope, all eligible initial passages reaching outcomes, and no pending/running expansion obligation. Failures and unresolved judgments remain visible even when processing is complete. Discovery with remaining work is incomplete. A complete child batch cannot imply parent completeness. Re-filtering never rescans, changes coverage, resumes an early stop, or expands context.

A parent invocation uses one decreasing deadline and lower request/input budget across all of its child calls, including retries and expansions. Subtract actual deterministic invocation request/input-byte deltas, not cumulative ledger totals or native token/cost usage. The current public `usageDelta` is native Usage, not this budget delta; future semantic implementation must expose trusted internal per-invocation charged-unit counters from the existing coordinator, including unknown-usage attempts and excluding proven nondispatch releases. Do not estimate these counters from concurrently changing session totals. Do not reset the invocation allowance for each child batch. At most one child batch of eight items is submitted ahead per parent; no second child is prepared until the prior child settles. Shared coordinator fairness and concurrency remain authoritative. Freeze the model/configuration identity at parent creation and enforce it on every child/follow-up. Cancel/disable/navigation propagates to child signals and drains promises before slots free. Already-started work stays charged. Parent aggregation reports fresh child usage once at its own tool boundary.

### 6. Deterministic file access and exclusions

Default Git candidates are tracked working-tree files plus non-ignored untracked files, deduplicated with NUL-safe enumeration. Nested repositories/submodules are not traversed implicitly. Outside Git, reject implicit recursive discovery with `git_required`; permit only caller-explicit root-relative regular file paths inside the current project root. This supports non-Git projects without inventing ignore semantics. Document it prominently rather than silently searching everything.

Reject absolute paths, traversal, escapes, nonregular files and symbolic-link/reparse-point traversal by default, including intermediate components. Resolve/check the root and access path before opening, verify capture against concurrent changes, and fail closed where platform checks cannot establish confinement. Document residual trusted-workspace/concurrent-mutation limitations rather than promising a sandbox against a malicious local process.

Independent exclusion layers apply even to Git-tracked and explicitly named candidates: invalid UTF-8/NUL binary content, size bounds, sensitive paths and dependency/generated/build content. Initial default sensitive classes include `.env` variants, credentials/secrets directories, private key formats and known credential filenames; omit source content from exclusion diagnostics. Initial dependency/build classes include `node_modules`, `.git`, `vendor`, `dist`, `build`, `coverage`, `.venv`, `__pycache__`, source maps and lockfiles. Enumerate exact case/segment/extension rules in the applied contract rather than leaving implementation to infer globs. User configuration may add exclusions; model-facing arguments may only narrow scope. Initial release does not offer tool-controlled overrides of these safety defaults. Heuristics cannot certify absence of secrets.

Alternative: recursive non-Git walk or agent-supplied ignore override. Rejected because implicit traversal and weakening exclusions are unnecessary to the initial product and create less auditable evidence scope.

### 7. Experimental bounds, windows, expansion and rendering

Proposed engineering bounds, not measured optima: predicate 2 KiB UTF-8; 128 filter records; 16 KiB text per record within the existing 1 MiB submission cap; enumeration 10,000 entries; admitted files 256; file 1 MiB; initial windows 2,048; window at most 64 whole lines and 8 KiB; overlap up to eight whole lines with guaranteed forward progress; page default 20 and maximum 100 items/128 KiB. A line exceeding the passage byte bound is an explicit excluded range, never silently truncated evidence. Scope-bound stops are incomplete, not exhaustive negative answers.

Adopt the existing 8 MiB retained-data ceiling as a combined parent/child evidence-and-answer accounting ceiling, not an independent 8 MiB pool per search. Future implementation must reserve bounded parent metadata and worst-case result space before admission, account retained copies, and permit explicit release without evicting live handles. Limit to eight semantic parents within the same runtime; existing core batch count remains 32. This measures retained serialized data, not a hard JavaScript heap guarantee. Do not introduce another scheduler or financial allowance to implement a memory cap.

An eligible verified file passage with raw insufficient-context may add up to 32 neighboring lines on each side once, capped at 128 lines/16 KiB and the actual remaining bounds. Verify full captured-file identity before expansion; changed/missing/unverifiable evidence remains unresolved with an explicit reason, without substituting new bytes. No expansion for record provenance, below-cutoff matches, failed judgments or cross-file references. Retain both original and expanded raw judgments; the final successful expansion judgment controls the derived outcome, while a failed/blocked follow-up preserves an unresolved result and its original judgment. Follow-up attempts share pinned model, request/input ceilings and normal retry policy; a retry of the same expansion is not a second widening.

Default snippet output is at most 20 lines/2 KiB per evidence item, with exact displayed ranges and explicit truncation inside the page cap. Additional captured snippets use `semantic_evidence`; current-source checks flag changed/missing/out-of-scope separately. Phase G must inspect the actual pi-multiedit hash algorithm and verify golden N#HH compatibility; do not invent or approximate it in B. Structured ranges and SHA-256 remain authoritative independently of rendering.

### 8. Pilot population, labels and leakage controls

The applied pilot plan specifies 36 realistic task slots: 12 tuning and 24 held-out, with at least eight held-out tasks per source/language stratum. Proposed tuning source is this project's generic execution slice (private until explicitly approved for transmission). Proposed held-out strata are pinned public CPython pathlib, Go io/fs and Node internal fs snapshots. Record exact revision/content manifests, license and scope before collecting labels or running experiments. Public release refs are selection targets, not proof of a downloaded or immutable snapshot. No download, source transmission or live evaluation occurs in this proposal.

Task families cover behavioral paraphrases without query words, misleading lexical near-matches, real no-match queries, boundary-spanning context, ambiguous dependency behavior, and realistic record filtering from logs/diffs/search snippets. Keep source repositories and derived records disjoint across tuning and held-out. Synthetic adversarial instructions, source mutations, failures, cancellation and budget boundaries supplement but do not replace realistic tasks. Document cross-language/source distribution shifts rather than treating one held-out score as universal accuracy.

For each task, specify predicate, scope, minimal relevant source spans, match/no-match/insufficient rationale and admissible supporting context. Two reviewers independently inspect source, reconcile disagreements, and retain unresolved ambiguity explicitly. Agents may assist annotation, but model-produced labels or agreement between models alone are not ground truth: retain source-grounded justification and independent adjudication, with human review or independently executable evidence validating the adjudicated labels. If that verification or independent review is unavailable, the quality gate is unverified. Keep held-out labels/results out of tuning; compare spans, deduplicate overlap and predeclare matching rules so repeated windows cannot inflate recall.

The plan must name the task slots and give concrete task descriptions, manifest fields, annotation examples and review procedure. Source hashes and actual labels are populated/frozen before authorized phase-H runs; they are not invented during B. Do not inspect held-out performance to adjust windows, rubrics or thresholds. A failed held-out gate requires a bounded remediation change and a fresh untouched held-out set.

### 9. Baselines, measurements and promotion gates

Generic baseline: straightforward native codemode classification of the same identified states/questions with the same model and explicit bounded run budget. Compare initial completion, interruption/resume, repeated submission, concurrent consumers and failure handling. Disclose any bookkeeping the baseline adds; do not intentionally weaken it. Record requests, duplicate successful attempts, recovery work, bytes returned to the frontier, shared-budget compliance, latency and known usage/cost. Require the managed path to preserve completed work, achieve zero redundant provider calls on eligible reuse, respect one shared allowance, and demonstrate at least one operational advantage without loss of completed answers on the paired workload. Deterministic evidence establishes mechanics; live paired runs remain separate required evaluation evidence.

Semantic baseline: ordinary frontier-agent search using read/grep and normal navigation within the same snapshot/scope and task/time/output limits, without the semantic tools. Include a literal/regex retrieval reference to show whether a model adds value beyond simple searches; no embeddings dependency is introduced. Use the same frontier model and an explicit logged protocol for downstream investigation of semantic evidence. Count all follow-up reading and model work, not just the first tool response. Preserve no-match and unresolved cases rather than dropping inconvenient tasks.

Proposed pilot release gates (agent-selected investigation-tool targets, not calibrated model facts):

- All deterministic safety, provenance, partition, budget, lifecycle, schema and no-call re-filtering cases pass; no safety failure is averaged away.
- Evaluate all 24 realistic held-out tasks, with at least 100 adjudicated positive source spans and at least six genuine no-match tasks overall. If the sample lacks these minima, acquire new untouched tasks under the same sampling plan before running; do not call a smaller sample a pass.
- Systematic held-out span recall at least 0.90 and precision at least 0.80; per-source recall at least 0.80; unresolved fraction at most 0.25. Unresolved positives count as retrieval misses, not exclusions from recall. Report micro/macro results, per-stratum counts and 95% Wilson intervals; these are pilot point-estimate gates with disclosed uncertainty, not broad reliability guarantees.
- Discovery finds at least one adjudicated match within its five-result budget on at least 0.80 of positive tasks, and returns no accepted match on at least 0.80 of genuine no-match tasks. Report unexamined scope and result-budget effects alongside usefulness.
- Median total frontier-visible evidence tokens, including downstream reads, at most 0.75 of the paired frontier baseline; median task completion latency at most 2.0 times baseline. Report p95, individual regressions and downstream task success; success must not be lower than baseline. Use a named tokenizer or the actual frontier usage when attributable; bytes are supplementary, not mislabeled tokens.
- Three measured runs per paired live condition with fixed versions and disclosed order; freeze tuning settings first. Report total known cost (classifier, frontier, retries and downstream work), unknown usage/pricing counts and sample coverage. Unknown prices never become zero-cost savings; no cost-improvement claim is permitted without complete comparable cost data. Cost reduction is not a promised release gate.

Insufficient authorization, credentials, labels, counts or measurements means not run/unverified, not pass. These gates may be revised through explicit planning review before held-out results exist; after observing results do not relax them to declare success. Defaults remain experimental until supported by model-specific evidence. The smallest falsifying experiment is the tuning-only paraphrase/near-match/split-context trio: failure to retain useful evidence at acceptable downstream reading volume questions the proposed rubric before scaling the pilot.

### 10. Evaluation authorization and release ownership

The operator authorizes each live evaluation with exact provider/model identities, disclosed evidence sources, finite request/input/work bounds, permitted retries, frontier baseline spend and transmission scope. Produce a dry-run manifest with worst-case attempts (including expansion/retries) before requesting that authorization. Credential presence, downloaded public code and approval to write docs do not authorize classifier execution. Never acquire credentials or silently use another model.

Maintainers own label adjudication and release decisions. Adoption is offline deterministic verification, explicitly authorized pilot, then limited opt-in use only after gates pass; a model/rubric/preparation change requires re-evaluation. Failures return explicit unresolved/failed work for ordinary investigation; do not automatically call a frontier model as fallback. Roll back by disabling semantic-family execution while retaining generic behavior, ledger liability and historical transcript evidence. Keep source text out of routine diagnostics; only explicitly authorized evaluation artifacts may retain disclosed evidence/labels.

## Risks / Trade-offs

- Conservative missing-context outcomes can reduce recall and increase follow-up reading → retain unresolved evidence, measure downstream work, permit only one bounded expansion.
- Label-only cutoffs may admit false positives → mark experimental, tune on the designated set and require held-out precision; do not equate probabilities with correctness.
- Small pilot and cross-language shifts limit generalization → publish counts/intervals/strata and model-specific limitations; do not claim universal quality.
- Non-Git explicit-file mode and immutable exclusions omit relevant material → surface exclusions and scope honestly; do not claim full-project coverage.
- Files may change during capture or after judgment → detect/flag changes, retain captured identity, and disclose non-adversarial workspace assumptions.
- Parent memory and invocation accounting can accidentally duplicate core pools → require explicit combined bounds and parent-budget tests in C/E/G; source inspection shows this is new work, not already implemented.
- Native cost/usage or backend versions may be unknown → retain that uncertainty and withhold unsupported cost/reproducibility claims.

## Migration Plan

After a fresh explicit apply handoff, create the three documents, perform a source-grounded consistency/cold-reader audit and update entry-point/status documentation. Verify the existing package still builds/tests, strict OpenSpec validation accepts a zero-delta documentation change, and no runtime/configuration/dependency file changed. Archive without spec synchronization only after every documentation task is verified. Then propose C with behavioral deltas and a separate apply handoff. No runtime migration or provider call is part of B; rollback is reverting the new document links/status annotations without altering runtime or ledger data.

## Open Questions

No remaining question changes this documentation scope or task breakdown. Empirical outcomes, exact authorized models, immutable evaluation snapshot hashes, adjudicated labels and availability of live credentials are explicitly unmeasured phase-H prerequisites, not reasons to invent results or authorize execution. Exact documented schema field definitions and exclusion lists are bounded apply deliverables governed by the decisions above.
