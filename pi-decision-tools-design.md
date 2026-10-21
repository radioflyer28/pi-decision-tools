# Pi Decision Tools — Design Contract

**Status at baseline approval:** User-approved conceptual baseline; implementation had not started.

**2026-10-15 status annotation:** The generic execution slice is implemented and archived; semantic capabilities and quality evaluation are not. The future semantic handoff is in [semantic contract](docs/semantic-contract.md), [acceptance cases](docs/semantic-acceptance.md) and [pilot plan](docs/pilot-plan.md). Original requirements below are preserved; historical references to unimplemented work are not current verification claims.  
**Working name:** Pi Decision Tools. Repository and published package name are not final; the initial distribution is one package.  
**Audience:** Maintainers, Pi extension authors, and agents planning the implementation.  
**Purpose:** Define the initial product, its invariants, and the remaining experiments so implementation can be planned without reconstructing the design interview.

> **Authoritative scope correction:** Initial decision batches and searches are ephemeral. Cross-restart batch/search persistence is not required. Pi Durable runtime support is a separate future roadmap item. Earlier discussion of durable source snapshots, restart checkpoints, session-deletion cleanup, and cross-session artifact ownership does not apply to the initial release.

## 1. Product intent

Build a single, modular, codemode-first package of tools that offload bounded semantic judgments from a frontier LLM to Pi's available classifier/decision models. The first capabilities are generic managed decision batches, semantic codebase search, and filtering of caller-supplied text records. Semantic grep remains a primary capability; the generic batching entry point also provides independent value to codemode agents without invoking or enabling semantic grep.

The primary benefit is reducing the irrelevant evidence and reading work that enters the frontier model's context. Lower elapsed time and lower total cost are hypotheses to measure, not guarantees. Useful recall and precision must be measured alongside context savings.

This is distinct from existing navigation tools:

- Text grep finds literal or regular-expression occurrences.
- ast-grep finds syntactic structures.
- LSP provides symbol definitions, references, and related language intelligence.
- Semantic grep identifies passages that satisfy a natural-language description or behavioral predicate, even when the query's words are absent.

The tool supplies evidence for investigation, not proof of whole-program behavior. It does not autonomously trace arbitrary dependencies or become another coding agent.

## 2. Package and module responsibilities

Start with one installable package, provisionally named `pi-decision-tools`, with three internal responsibilities and separate evaluation assets. Internal module boundaries are not separate npm package boundaries.

| Internal module | Responsibility |
| --- | --- |
| Core | Managed native classifier execution: model selection, batches, scheduling, budgets, retries, result reuse, and lifecycle; experimental documented library interface for extension authors |
| Generic decision tools | Identified decision batches, structured results, and continuation for codemode agents, independently of semantic grep |
| Semantic tools | Filesystem semantic grep, text-record filtering, evidence preparation, and search-specific results |
| Evaluation suites | Separate core, generic-batch, and semantic-search tests, fixtures, and baseline comparisons |

```text
pi-decision-tools (one package)
  ├── Core ── Pi native classifiers
  ├── Generic decision tools ── Core
  └── Semantic tools ────────── Core

Entry points:
  Pi extension ── registers commands and tool families
  Library ─────── side-effect-free exports for extension authors
```

One installation and one package version ship both tool families and the reusable library. Both tool families invoke the core directly; semantic grep need not call the generic decision tool internally. Keep rendering and interactive UI separate from execution and semantic-search logic.

### Entry points and configurable tool families

The Pi extension entry point registers commands and tools. The public library entry point is side-effect-free: importing it must not register tools, initialize session resources, or start work. External extension authors can use the executor without depending on filesystem-search behavior or understanding Git discovery, chunking, or hashlines.

Tool families should be independently configurable within the package. Installing the package need not declare every tool to the frontier model; use Pi's codemode-oriented exposure where appropriate. Enforce enablement and authorization at execution time, including codemode calls, rather than treating visibility as permission. Keep core imports independent of semantic-search implementation dependencies.

Separate distribution is deferred unless actual needs emerge, such as heavyweight optional dependencies, different release lifecycles, or consumers requiring independent installation. Do not introduce a multi-package monorepo solely to express internal module boundaries.

### Value beyond native codemode

Pi already supplies classifier discovery, credentials, provider integration, native typed model calls, usage reporting, and codemode composition. The toolkit does not claim these as new capabilities or automatically improve model accuracy.

The additional value is managing a body of decision work: identified items, partial completion, retries, continuation, reuse, and cumulative user limits across calls. Simple one-off questions may be better served by native `models.classify()` without this toolkit.

Codemode cannot import an arbitrary npm library directly. The package's registered generic decision tools provide the supported agent-facing entry point to the core; extension authors can consume its library exports directly.

### Shared library scope

- Resolve available models and validate the user's selection.
- Execute native `choice`, `bool`, and `score` questions over identified inputs.
- Manage bounded batches, per-item outcomes, partial completion, and continuation.
- Apply shared concurrency limits, cancellation, same-model bounded retries, and budgets.
- Distinguish valid judgments, rubric-defined abstention/insufficient evidence, invalid responses, and provider failures. Do not impose a semantic-match rubric on arbitrary questions.
- Associate results with input IDs, input/evidence versions, model identity, and question/rubric versions.
- Reserve and account for requests and input volume; report provider usage, cache hits, and latency without inventing unknown prices.
- Reuse eligible judgments within the active runtime using input, model, and question/rubric identity, not an item ID alone.
- Maintain ephemeral batch state and explicit expired-handle errors.
- Provide structured diagnostics without logging source text by default.

Code chunking, context expansion, and search-specific relevance policy belong to the semantic tools module. A general workflow framework, replacement provider SDK, and host-independent runtime abstraction are not initial goals. Keep the public library interface small and explicitly experimental.

### Shared session coordinator

Both internal tool families and participating library consumers must use one compatible session-scoped execution coordinator for authorization, selected-model policy, scheduling, budget reservations/accounting, and eligible runtime reuse. Parallel generic batches and semantic scans must not receive independent copies of the session allowance or concurrency pool.

The package's extension entry point initializes the shared facilities once. Do not rely solely on npm module-instance identity: external extensions may import distinct copies of the library. Define explicit coordinator ownership/access, interface-version compatibility, lifecycle, and idempotent registration before implementation. Importing a library copy must not silently allocate a second session allowance, register duplicate commands, or create an independent scheduler for the same toolkit session. Incompatible coordinator versions must fail clearly rather than silently create separate enforcement domains. The exact mechanism remains an implementation-design decision.

This coordinator manages calls through the toolkit. It is not a host-wide classifier security boundary.

## 3. Agent-facing capabilities

### 3.1 Filesystem semantic grep

Systematic mode is implemented in Phase E. Discovery (Phase F) implements relevance-aware yielding through E's passage scanning and deterministic order; verification, spec synchronization and archive are complete (see [discovery verification](docs/discovery-verification.md)):

| Mode | Behavior | Coverage contract |
| --- | --- | --- |
| Discovery (Phase F) | Scan the declared scope until a qualifying-evidence target, scope exhaustion or execution constraint; never pad hits with weak matches | Report yield/stop reason, unexamined work and continuation eligibility; yielding is not scope completion or answer sufficiency |
| Systematic | Evaluate every eligible passage in the declared scope unless interrupted or limited | Report evaluated, unresolved, failed, excluded, and remaining work |

No embedding index or query-word-based candidate gate is required initially. Systematic mode must not silently discard passages using a relevance prefilter.

“Complete” means the eligible processing scope was covered. It does not mean every semantic match was found or every judgment was conclusive. Output truncation is separate from incomplete scanning.

### 3.2 Generic semantic filtering

Accept identified text records and a natural-language predicate. Records may originate from grep, LSP, diffs, logs, retrieval, or other tools.

Each record contains an ID, text, and optional provenance. Caller-supplied provenance is not treated as verified filesystem evidence. Same-file context expansion is available only for appropriately verified file-backed evidence.

Search and filtering return compatible evidence and judgment conventions so codemode can combine their outputs.

### 3.3 Generic managed decision batches

The generic decision tools accept bounded identified records and native typed questions. Inputs are caller-supplied JSON state compatible with Pi's classifier contract; the semantic-filter convenience interface remains focused on identified text records.

Expose structured submission/execution, result retrieval, and continuation capabilities, without fixing tool names yet. Preserve per-item identity and distinguish completed answers, failed items, and work not yet attempted. A continuation resumes remaining eligible work without automatically repeating successful items. Record model and question/rubric identity so changes cannot silently alter an existing batch.

Generic batch completion means the submitted items have reached reported outcomes; it does not establish semantic search coverage. It may include failed items and must not be presented as universal success. Only semantic tools know the discovery scope, exclusions, unsubmitted passages, and context-expansion obligations. A completed underlying batch can therefore belong to an incomplete search.

The batch API does not require files, line ranges, hashline rendering, a match/no-match rubric, or an unbounded streaming interface.

### 3.4 Composition contract

Provide convenient one-shot use and bounded resumable calls. Agents must be able to:

1. Submit generic decision batches, search files, or filter supplied records.
2. Run independent batches and queries in parallel within the same session limits.
3. Join, deduplicate, and filter structured results without parsing prose.
4. Retrieve additional result pages or selected snippets.
5. Resume unfinished work during the active runtime.
6. Re-filter saved raw judgments using different cutoffs without another provider call.
7. Return only useful evidence or a summary to the frontier model.

A public prepare-corpus interface is not required initially. Internal evidence reuse should not force agents to manage an indexing lifecycle. A background-job subsystem is also out of initial scope.

Exact tool names and schemas remain to be designed. Examples discussed in the interview were illustrative, not a frozen interface.

## 4. Evidence preparation and judgments

Use language-agnostic bounded text windows initially. Preserve paths, exact line ranges, and neighboring context; do not claim whole-function or whole-program understanding. Window size, overlap, prioritization, and input limits require evaluation.

The search/filter semantic contract distinguishes:

- Match.
- No match.
- Insufficient context.

For ambiguous verified file evidence, perform at most one bounded same-file context expansion and rejudge. If still unresolved, return it for frontier-agent investigation. Do not follow arbitrary cross-file dependencies.

Source text is evidence, not instructions. Deterministic code controls access, scope, budgets, and output provenance. Classification cannot grant permissions or override those controls.

The semantic tools return source evidence rather than generated explanations; generic batches return typed answers. Paths, line ranges, and snippets come from deterministic processing, not classifier-generated locations.

### Semantic-tool execution through shared batches

1. Discover eligible files or accept supplied text records, then prepare identified evidence.
2. Submit bounded judgments directly through the core executor and its shared session coordinator.
3. Consume completed answers, failures, and remaining work.
4. For eligible insufficient-context cases, prepare the single permitted local expansion and submit follow-up judgments through the same executor and allowance.
5. Assemble semantic matches, unresolved cases, scope coverage, and continuation information.

Both filesystem search and text filtering must use this execution path rather than duplicate scheduling, retries, usage accounting, or caches. Semantic tools own the parent search's evidence and coverage state; the executor owns execution of submitted items. Cancel/stop propagation and result accounting across that relationship must be specified.

Discovery owns enumeration and scanning within the declared scope, using bounded internal batches with limited work scheduled ahead. Internal batch completion alone is not a relevance yield: continue seeking qualifying evidence until its explicit target, scope exhaustion or an execution constraint. Never lower thresholds or return weak hits to fill a quota; forced handoffs may have few or no qualifying hits, with failures and insufficient context reported separately. A run of low or declining relevance in file order is not grounds to stop before later passages. Already-started requests must drain and their outcomes and usage remain accounted for, including target overshoot. Systematic mode continues submitting eligible passages within the user's limits.

After a yield, the main LLM chooses whether to investigate the hits, explicitly continue retained work, start a different query/scope or stop. Continuation preserves successful judgments and remains subject to authorization, expiry and resource limits; paging/re-filtering alone schedules no work. A new directory scope creates a new search, not a mutation of an existing frozen capture.

Discovery does the scoped searching; the main LLM directs the investigation, follows calls/references and decides whether evidence is sufficient. F does not autonomously follow code relationships or expand context. Target-based yielding promises qualifying hits, not global top-k, diversity or answer sufficiency. F uses E's existing order and semantic-v1/immutable creation policy. Targets default to5 (1–100), count new qualifying evidence IDs per executing invocation including overlapping windows, and yield between settled eight-item children (overshoot≤7). Ordinary continuation seeks additional hits; discovery defaults to `new_matches` with cumulative `matches`/diagnostic `all` views. Changing the view never changes the stopping policy. Adaptive ranking and declining-relevance stopping are out of scope; further ordering and redundant-hit reduction need separate justification.

The optimization objective is useful evidence per handoff and lower total investigation cost, not minimum scan work per call. Separate scan volume from returned evidence volume: spend inexpensive judgments to reduce expensive LLM turns without padding hits or flooding context. Evaluate qualifying findings per handoff, LLM turns, total decision-model plus LLM cost (including returned evidence), latency and task success against E. A100x content-per-dollar advantage is an operating hypothesis, not a measured guarantee. Live evaluation still requires separate authorization; existing evaluation gates are unchanged.

### Cutoffs and re-filtering

Agents may select cutoffs, with reasonable documented defaults. Retain raw typed answers within the active runtime workspace and record the selected cutoff policy on derived results. Changing a cutoff can reuse those answers without new model calls.

Insufficient context, invalid output, and provider failures must never silently become negative matches merely because of a cutoff. Scores and confidence values are not assumed to be calibrated equally across models or to represent empirical correctness.

The rubric, score interpretation, and initial per-model defaults must be evaluated. Their exact numerical values are not yet approved.

## 5. Structured results and hashline compatibility

All toolkit results should expose appropriate structured identifiers, actual model identity, question/rubric version, per-item outcomes, machine-readable failures, usage, truncation, and continuation information.

Generic batch results distinguish completed answers, failed items, and remaining work. They must not fabricate source provenance or force arbitrary choices/scores into semantic-match statuses.

Semantic search/filter results additionally expose:

- Search/result IDs and stable evidence IDs within their supported lifetime.
- Cutoff/policy identity for derived match sets.
- Source path, line ranges, and strong captured-content hashes when applicable.
- Bounded snippets by default, with additional results accessible through pagination.
- Matches and unresolved evidence as distinct collections or statuses.
- Coverage, skipped/excluded work, remaining work, and reasons for stopping.
- Output truncation independent of scan completion.

The exact schema is open. Human-facing rendering must not become the programmatic interface. Pi's `outputSchema` and `structuredContent` support should be used so codemode receives data instead of rendered prose.

### Hashlines

Render snippets using `pi-multiedit`-compatible `N#HH` anchors while preserving structured locations and strong hashes independently. This is rendering/interoperability, not a dependency on or replacement for an editing extension.

Short line hashes are not unique evidence identifiers or proof that surrounding context remains unchanged. Results describe captured bytes and their original ranges. Reading current source must detect or flag relevant changes rather than silently presenting an old judgment as current.

Do not assume that a whole-file `anchored-view` integration supports partial search snippets. Such editing-state integration is not an initial requirement.

## 6. File discovery and safety scope

Default repository candidates include Git-tracked working-tree files plus non-ignored untracked files. Apply independent content and path rules even to tracked candidates:

- Exclude binary content, including committed images.
- Enforce file/input size bounds.
- Exclude configured sensitive paths and dependency/generated/build content.
- Do not follow symlinks by default.
- Report exclusions and their reasons sufficiently to explain coverage.

Git-aware discovery and application-specific exclusions are separate layers. Exact exclusion defaults, override rules, and behavior outside a Git repository remain implementation-design work. Sensitive-path heuristics do not guarantee that source contains no secrets.

## 7. Model selection and authorization

- A new session starts disabled for classifier processing through the toolkit.
- A user command enables processing and resolves a model.
- If several credentialed models are available and no valid configured default resolves selection, require a picker.
- A sole available model may be resolved without a multiple-choice picker.
- Users can explicitly save a default model. A default does not itself enable processing.
- Reopening a saved session requires re-enablement before new provider calls.
- Noninteractive execution supports explicit startup opt-in, a resolvable model, and budgets. Ambiguity fails rather than guessing.
- Credentials alone do not imply permission to transmit evidence.
- Each batch and search pins its selected model. Switching the session selection does not silently migrate unfinished work. Semantic follow-up batches must preserve the parent search's model policy.
- No silent fallback to another provider, classifier, or frontier model.

Mutable provider aliases may prevent exact backend-version reproducibility even when provider/model IDs are pinned. Disclose that limitation.

Exact command names, configuration fields, and disable/cancellation behavior must be specified before implementation. No toolkit call, including a semantic tool's direct library invocation, should bypass the shared session authorization. This does not govern unrelated native classifier calls.

## 8. Budgets, concurrency, and failures

User ceilings constrain agent requests. Agents may request lower budgets but must not silently raise user limits.

Maintain one cumulative saved-session budget ledger across toolkit batches, searches, filters, retries, parallel calls, and continuations. Semantic tools must not charge the same classifier request again merely because they aggregate its batch results; follow Pi's usage-reporting contract to avoid duplicate session-cost reporting. Re-enabling or reopening does not reset spending limits. Only explicit user action replenishes the allowance.

Use deterministic limits such as request count, input volume, and elapsed work bounds. Monetary figures are estimates only where pricing is known. Unknown in-flight usage after interruption must be represented conservatively rather than assumed free; exact reservation/reconciliation rules remain to be designed.

Apply concurrency limits through the shared coordinator across both tool families' and participating library consumers' concurrent calls, not only within each batch or search. Do not assume codemode's limit for direct classifier calls also governs extension-internal calls.

These budgets and authorization controls apply only to work submitted through the toolkit. They do not prevent or account as toolkit work for independent `models.classify()` calls or other extensions' direct provider calls. Host-wide enforcement would require a separate integration and is not promised.

Transient failures may receive bounded retries on the same model. Preserve completed work and report failures or partial results explicitly. Authorization errors, invalid inputs, missing models, and exhausted budgets must not masquerade as no matches.

An expired ephemeral batch or search cannot be resumed as a provider retry: new execution requires resubmission and consumes the existing cumulative budget.

## 9. Initial lifetime and persistence contract

### Ephemeral during the active session/runtime

- Captured evidence and strong evidence hashes.
- Raw classifier judgments and derived result sets.
- Result pages, evidence reuse, and cutoff re-filtering.
- Batch/search continuation handles, per-item execution state, and unfinished scan progress.

These are not promised to survive process restart or session reopening. Tool calls using old handles must return an explicit expired-batch or expired-search condition, such as `batch_expired` or `search_expired`, rather than silently rerunning work, rescanning, or substituting current files.

### Persisted using Pi's normal mechanisms

- Tool results/snippets actually recorded in the conversation.
- Summaries or selected results a codemode script prints into the conversation.
- Explicitly saved model defaults.
- The cumulative saved-session budget ledger.

Intermediate tool data that codemode neither returns nor otherwise persists is not automatically preserved as a user-visible transcript result. There is no initial persistent repository source cache or persistent full batch/search-result store.

### After reopening

Previously recorded findings remain readable as historical evidence. They are not automatically current. Private batch/search workspaces and their continuation handles are expired. New toolkit classifier work requires re-enablement; a generic batch requires resubmission of its inputs, and an interrupted scan must be started again against current files.

### Forks and branches

Do not share mutable progress or automatically transfer authorization to a new session. Inherited transcript findings remain historical evidence. Cross-session artifact ownership is not implemented initially. Exact active-runtime handle behavior on branching, switching, and extension reload remains to be specified conservatively before implementation.

Budget accounting must not be rewound merely by navigating an older branch. The implementation must distinguish branch-local batch/search state from cumulative financial/resource accounting.

### Explicitly removed from initial scope

- Persistent captured-source sidecars.
- Cross-restart batch/scan checkpoint restoration.
- Session-deletion-driven persistent artifact cleanup.
- Cross-session ownership/reference tracking of search artifacts.

Temporary implementation storage, if needed, must not imply a persistence guarantee.

## 10. Evaluation and release evidence

Use a measured pilot before claiming useful performance. Compare semantic tools against ordinary frontier-agent search under representative tasks and disclosed evidence access. Independently compare generic managed batches with straightforward native codemode classifier scripts; demonstrate operational value rather than assuming another wrapper is beneficial.

Measure:

- Frontier-context consumption and downstream reading work.
- Semantic recall and precision.
- Unresolved/insufficient-context frequency.
- Discovery usefulness under a bounded result/context budget.
- Processing coverage and consequences of incomplete scans.
- End-to-end latency and total cost, including retries and subsequent investigation.

The dataset should include realistic queries, paraphrased behavior, misleading vocabulary, genuine no-match cases, split context, source changes, provider failures, and adversarial instructions inside evidence. Synthetic fixtures supplement rather than replace realistic cases. Labels need an explicit rubric; model-generated labels alone are not ground truth.

Test the single package with each tool family enabled alone and both enabled together. Test side-effect-free library imports and external consumers loading separate library copies to verify that registration, shared authorization, concurrency, and cumulative accounting remain coherent. Test partial-batch continuation, preservation of successful items across retries, runtime expiry, compatible result reuse, and absence of double charging. Explicitly test that underlying batch completion does not misreport parent search completion.

Separate tuning from held-out evaluation. Report model-specific results and limitations. Test deterministic contracts independently: scopes, hashes, limits, shared scheduling, expiry, authorization, usage accounting, structured output, and cutoff re-filtering.

Passage sizes, concurrency defaults, budget defaults, model-specific cutoffs, representative repositories/languages, and numerical release gates are not settled. Set them explicitly before claiming the pilot passed; do not infer them from vendor benchmarks.

## 11. Non-goals for the initial release

- Replacing grep, ast-grep, LSP, or edit tools.
- Cross-file autonomous investigation or whole-program proof.
- Embedding indexes or vector databases.
- Provider/authentication SDK duplication.
- Silent generative-model fallback.
- A general decision workflow framework.
- A host-independent toolkit supporting multiple harnesses immediately.
- Persistent batches or searches across restarts.
- Host-wide interception or enforcement of all native classifier calls.
- A Pi Durable runtime adapter.

## 12. Roadmap items — independent decisions

### A. Cross-restart batch/search persistence

Reconsider only if interrupted or repeated large batches/scans justify it. This would require explicit design for snapshots, checkpoints, result retrieval, retention, cleanup, ownership, and interrupted-request accounting. It can be implemented for ordinary Pi without adopting Pi Durable.

### B. Pi Durable runtime adapter

Support the separate Pi Durable harness through a future adapter if needed. Pi Durable shipped alongside Pi 1.0; it is not automatic durability for ordinary coding-agent extensions. This adapter does not retroactively require persistent searches in the initial Pi extension.

These are local roadmap decisions, not externally filed issues.

## 13. Next planning work

The conceptual direction is approved, not implemented or empirically validated. Before coding:

1. Choose the repository/package names and move this contract into the repository's documentation with an entry-point link.
2. Specify the minimal generic-batch and semantic tools, library interface, shared command/configuration surface, and lifecycle behavior. Specify the extension and side-effect-free library entry points, configurable tool-family exposure, and explicit coordinator ownership/access and compatibility for internal tools and external library consumers.
3. Define the pilot tasks, labels, baselines, and release gates for semantic quality and independent managed-batch utility.
4. Select initial numerical defaults from evidence or explicitly mark them experimental.
5. Decompose the implementation into testable slices without reintroducing deferred persistence infrastructure.

## 14. References and observed integration facts

- [Pi classifier models](https://pi.dev/docs/latest/models#use-classifier-models): native classifier model discovery and invocation.
- [Pi codemode](https://pi.dev/docs/latest/codemode#classify): typed classifier calls and programmatic tool composition.
- [Pi extensions](https://pi.dev/docs/latest/extensions): structured tool outputs, lifecycle, and session state. The design investigation used installed Pi 1.2.0 documentation; recheck interfaces before implementation.
- [Pi Durable announcement](https://earendil.com/posts/pi-durable/): separate experimental harness launched alongside Pi 1.0.
- [pi-multiedit](https://pi.dev/packages/pi-multiedit) and its [hash implementation](https://github.com/jkeskikangas/pi-multiedit/blob/main/src/hash.ts): compatibility target for displayed `N#HH` anchors.

External interfaces may evolve. These references motivate integration choices; they are not evidence that this unimplemented tool meets its quality or performance goals.
