# Proposal

## Why

Phase E can systematically judge captured passages but cannot yield after accumulating relevant starting evidence. Phase F adds relevance-aware increments so the main LLM can direct an investigation without supervising small internal batches; lower total cost and fewer LLM turns are hypotheses to evaluate, not established benefits.

## What Changes

- Add explicit discovery mode to semantic_search over E's existing safe capture, deterministic order, semantic-v1 judgment and shared execution. Omitted mode remains systematic; no implicit migration of callers.
- Yield after an experimental per-invocation target of qualifying passage IDs (default5, configurable1–100), or scope exhaustion/execution constraints. Never lower relevance cutoffs, pad hits, or stop because preceding passages were irrelevant. At most the existing eight-passage child is scheduled ahead; settle and account for its overshoot.
- Make ordinary explicit continuation seek another increment without repeating successes or requiring cumulative-target arithmetic. A query/directory change is a new search. Keep retry validation, model/policy identity, lifecycle, budgets and no-refund rules.
- Default discovery pages to newly judged qualifying evidence from the latest execution; provide explicit cumulative-matches and all-outcomes views. Preserve all raw judgments, separate failures/insufficient context, bounded authenticated paging, complete coverage and zero-call view/evidence reads.
- Verify behavior with controlled classifiers at actual filesystem, session, host/QuickJS and installed-package seams; compare offline discovery/E operational increments and define the separately authorized live end-to-end experiment.
- Resolve provisional discovery sketches in current docs, without changing archived artifacts or weakening H's release-evaluation gates.

## Capabilities

### New Capabilities

- `discovery-semantic-search`: Relevance-aware yielding, additional-hit continuation, bounded discovery views, shared safety/resource lifecycle and evaluation evidence boundaries.

### Modified Capabilities

- `systematic-semantic-search`: Admit discovery through the shared search surface while preserving systematic defaults and exhaustive-within-limits behavior; allow explicit bounded discovery projections without weakening captured evidence access.
- `toolkit-integration`: Support both search modes through the existing eight tools and native usage boundary, while continuing to reject unsupported priorities/expansion controls.

## Impact

Extend src/semantic schemas, parsing, preparation, parent state, execution and results, plus semantic tool descriptions/wrappers as needed. Reuse existing coordinator, filesystem capture and bounded child retirement; no new dependency, scheduler, memory pool, persistent cache, library export or protocol change. Extend filesystem-search/semantic host tests, documentation examples and offline installed-artifact verification.

Agent design decisions (not separately user-approved numerical defaults): use per-invocation targets instead of the provisional cumulative target-increase API, count distinct qualifying evidence IDs (overlap remains disclosed, not diversity), and provide a new-matches default view to avoid returning old hits on every increment. Exact contracts and alternatives belong in design/specs.

## Non-goals

Autonomous call/reference traversal, adaptive ranking, declining-relevance stopping, semantic deduplication/diversity guarantees, context expansion/hashlines, calibrated probability or global top-k claims, live provider spending, publication and completion of G/H/I. This proposal does not authorize bypassing the required explicit handoff into apply.
