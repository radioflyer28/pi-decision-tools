# Design

## Context

See proposal.md for motivation and the three capability deltas for observable requirements. Phase E currently has closed systematic-only search input, frozen capture/preparation, eight-item children, one shared coordinator, parent retirement of settled nonretryable children, and all-outcome pages. SemanticExecution awaits each child before inspecting its results; SemanticResults already binds cursors to parent/revision/policy/limit. This is the seam for yielding, not a new scheduler.

Fresh pre-change baseline bg-27 passed typecheck, clean build and282/282 Windows tests across41 files. Inspected execution, preparation, parent ownership, result projection, validators/schemas, actual search execution fixtures and current main specs. This baseline is not verification of discovery. No live provider evaluation or independent review has occurred.

## Goals / Non-Goals

**Goals:** Implement additional-relevant-evidence increments with bounded internal work, explicit coverage, zero-call views and ordinary continuation. Keep record/systematic callers, eight tools, protocol1 and inert public exports compatible. Retain all judgments even when a discovery view omits them.

**Non-goals:** Changes to capture safety, the rubric, scheduler, user ceilings, provider selection, persistent storage, context expansion, automatic scope widening, lexical/adaptive ranking, declining-relevance heuristics, semantic diversity or calibrated-quality claims. G/H/I remain separate.

## Decisions

### 1. Reuse judgment; keep stopping deterministic

Use semantic-v1, the exact captured state and deriveOutcome with the immutable creation policy. A qualifying judgment has choice match and meets minMatchProbability; insufficient_context and below-cutoff answers stay unresolved, failed attempts stay failed. Reuse E's default policy (version1/minMatchProbability0): it trusts the explicit match label without inventing calibrated probability. Callers can supply a stricter experimental cutoff. No automatic lowering occurs. View policy can change independently without changing stopPolicy or scheduling work.

Alternative: add another model call for evidence sufficiency or calibrate a new score. Rejected: neither is required and both introduce unevaluated semantics. False positives can produce premature yields, false negatives can increase scanning/miss hits; continuation and honest coverage mitigate but do not establish correctness.

### 2. Targets are additional evidence per executing call

Keep mode omitted = systematic. Explicit mode discovery accepts targetMatches, integer1–100, default5. Systematic/filter inputs and continuations reject targets; priorities, caller roots, mode/scope mutation and expansion remain rejected. The creation target initializes parent configuration. A valid discovery continuation may replace targetMatches within1–100; omission retains the most recent target. This is a per-invocation target, not a cumulative match count. Every accepted executing invocation starts a fresh increment; previously completed judgments never count toward it. Preparation without run has an empty increment and no calls. Invalid target/identity/retry requests change neither revision nor increment state.

Count distinct newly completed qualifying evidence IDs, including eligible successful reuse or explicit retry completion. A passage counts once. Overlapping windows remain distinct IDs; this is not independent-source diversity. This keeps counting deterministic and avoids a new deduplication/ranking subsystem. Report the limitation and include overlap-sensitive operational comparisons; live evaluation deduplicates source spans as already required.

This deliberately replaces the provisional docs' cumulative target and explicit target-increase requirement. That API has never been implemented; update current contract/examples rather than preserving an awkward arithmetic interface. Alternatives considered: cumulative target (easy but a plain continue can stall), per-call count (chosen), independent semantic/source clusters (unjustified complexity).

### 3. Yield between bounded settled children

Use the same eight-item child boundary and deterministic UTF-8 path/range order. After a child settles, copy outcomes and usage, retire eligible storage, and count new qualifying judgments. Stop with target_reached if the target is met and retained pending/selected retry work remains; otherwise use existing complete/scope-limit semantics. Internal child completion is not a handoff when the target is unmet. At most eight passage judgments can be ahead of the decision; qualifying overshoot is at most seven, excluding no evidence or charge. Retries retain existing lifetime caps and may consume additional attempt units.

Execution constraints take precedence over a relevance yield: do not hide cancellation, deadline, disabled/model/storage faults or a child's budget stop just because some hits arrived. Recheck readiness/signals before submitting another child. Fully processed captured scope reports complete; exhausted retained work from incomplete capture reports its acquisition limit, not target_reached or exhaustive success. Cooperative drain can exceed the scheduling deadline, as in E.

A selected retry can remain unattempted if a target or hard constraint stops earlier; it remains explicitly eligible, and future retries require explicit selection. Do not consume or reset its lifetime allowance. Native worker order may be concurrent within the bounded child; public evidence ordering remains deterministic.

### 4. Separate scan volume from returned evidence

Discovery pages add view and yieldProgress to their declared schema. view is new_matches (default), matches (all qualifying retained judgments under the selected view policy), or all (every outcome, including pending/failed/unresolved/negative). Reject explicit view for systematic/filter parents to preserve their existing shape and all-outcome behavior. Discovery automatic search/continue responses use new_matches. All views include full scope/processing partitions, outcomeCounts, diagnostics, usage and ledger; omitted hits are not omitted coverage.

Persist a bounded latestJudgedIds list for successful completions during the last accepted execution, including reused/retried completions; clear it only when a valid new execution begins. new_matches filters this list through the selected view policy in original evidence order. Thus weak/negative/pending items cannot pad a handoff, but all raw outcomes remain inspectable through view all, and earlier qualifying evidence through matches. A valid zero-dispatch continuation has an empty latest increment; prior findings remain available. Pagination and re-filtering do not clear or consume this list.

For discovery, targetMatches is the configured per-invocation target, stopPolicy is the immutable creation policy, and yieldProgress.matched is the latest increment's qualifying count under stopPolicy, independent of the selected view policy. Include view selection in discovery viewIdentity/cursor binding; filtered pagination indexes eligible evidence consistently and never creates empty intermediary pages solely because nonmatching outcomes were skipped. Full envelope remains128KiB, default20/max100 items. No raw JSON/output API changes are required for systematic/filter pages.

Alternative: all outcomes by default with caller filtering. Rejected for discovery: it returns irrelevant text and can hide new hits behind old pages, defeating the increment's purpose. We retain that explicit diagnostic view, not the default handoff.

### 5. Preserve ownership, identity and enforcement

Add mode and creation stop-policy identity to discovery's execution identity, while excluding mutable view policy, target and latest-increment metadata. Keep systematic identity calculation unchanged. New query/directory scopes create new captures/parents; continuation cannot mutate frozen evidence or rescan changed/deleted source.

Store discovery configuration/latest IDs in the existing parent allocation and growth reservation; measure them on updates. No second pool or cache. Target validation and retry-set validation must finish before revision or target/list mutation. Child retirement preserves retry obligations, diagnostics and outcomes. Authorization precedes capture, persistence precedes dispatch, and every attempt uses the same session ledger/scheduler with no new grant or refund. Disable/navigation closes admission and drains capture, evidence reads and abort-ignoring providers; historical views remain readable in a live disabled generation. Actual Pi tools/QuickJS and physical package copies must observe the same owner and once-only native usage.

### 6. Evaluation and safe adoption

Implement reproducible offline operational comparisons over actual temporary source captures and scripted native responses, running E and F separately on equivalent inputs/model policies/budgets. Include dense, sparse, late, absent, below-cutoff, insufficient, failure and overlapping-hit distributions. Report classifier attempts/input units, qualifying and unique-source-span findings per handoff, new/repeated returned evidence bytes, explicit continuation/handoff count and observed elapsed time. A scripted controller is not an actual LLM: label its turn count a proxy. Cost is unknown unless both decision and LLM usage/pricing are measured; never substitute zero or assert100x savings.

Document the paired live procedure for H: same representative tasks, frozen tuning/held-out split, scope access and budgets; actual LLM turns, returned/downstream context, model usage/prices, total cost, latency and independently adjudicated task success/quality. Include retries, aborts and unresolved work. Preserve pilot sample minima and existing quality/latency/cost gates, and require separate authorization/credentials. Synthetic success proves control flow only. No live work is necessary or authorized for this phase.

Discovery remains opt-in by mode and semantic-family/session defaults remain disabled. Rollback is explicit systematic mode/new search, not a silent fallback or replay. Failed behavioral invariants block acceptance; failed later live gates retain E as baseline and require a separately scoped remediation, not changed gates.

## Risks / Trade-offs

- Eight-passage granularity can overshoot or spend after the decisive match → disclose maximum scheduled-ahead evidence, retain all outcomes/charges, test controlled drain.
- Overlapping windows can satisfy a target without diverse findings → explicitly count IDs, disclose source ranges, measure deduplicated spans; no diversity claim.
- Reusing an uncalibrated label/default cutoff can yield false positives → preserve raw answers and policy, separate behavioral acceptance from H quality gates.
- Extra latest-increment state or filtered cursors can leak memory/skip results → account retained copies, test long scans, full filtered traversal, stale/view mismatches and release/expiry.
- Scope may be fully captured before any yield → savings concern judgment/returned evidence, not lazy acquisition; do not claim early file-read termination.
- A simple continuation after a partial hard stop seeks a fresh full increment → document additional-per-call semantics and show prior hits separately; budgets remain authoritative.

## Migration Plan

After explicit apply handoff, extend existing internal modules, add targeted tests, and reconcile current docs/SM-26–27 with the selected semantics. Run typecheck/build/full Windows tests, actual Linux filesystem/discovery tests, real Pi/QuickJS and offline installed artifact verification, plus the reproducible comparison. Audit all delta requirements and security/lifecycle boundaries with clearly labeled same-agent review. Only then mark tasks complete, sync all three deltas preserving unrelated main-spec content, strictly validate main specs, archive with metadata and verify the destination/active-list state. Do not edit historical archives.
