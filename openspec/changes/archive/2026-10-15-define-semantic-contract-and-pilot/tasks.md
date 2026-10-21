# Tasks

## 1. Semantic contract

- [x] 1.1 Create `docs/semantic-contract.md` with status, audience, authority and the semantic-v1 choice rubric; verify positive, negative, ambiguous and adversarial examples distinguish raw judgments, cutoff rejection and operational failure without changing generic semantics.
- [x] 1.2 Specify closed record/file evidence, provenance, immutable execution and derived policy identities, raw-answer retention and result schemas; verify examples preserve exact source locations/hashes and cannot turn caller provenance into filesystem authority.
- [x] 1.3 Specify all five proposed operation input/output envelopes, limits, errors, release, paging, re-filtering and continuation including discovery target changes; verify a cold-reader walkthrough can prepare, run, page, re-filter, resume and handle expiry without hidden provider work.
- [x] 1.4 Define parent coverage partitions, discovery/systematic ordering, bounded scheduling ahead, per-parent invocation ceilings, pinned followups, cancellation/drain and once-only usage reporting; verify worked examples for complete child/incomplete parent, early stop, retry, cancellation and budget exhaustion balance counts and charges.
- [x] 1.5 Define Git and explicit-file non-Git discovery, exact default exclusion rules, root confinement, symlink/reparse behavior, UTF-8/newline/hash conventions, bounded windows and oversized-line treatment; verify boundary examples and exclusion totals do not imply unknown scope is empty.
- [x] 1.6 Define combined parent/core retained-data bounds, one verified same-file expansion, freshness, snippet limits and N#HH compatibility verification obligations for G; verify no second widening, cross-file access, unverified expansion or silent current-source substitution is permitted.

## 2. Pilot protocol

- [x] 2.1 Create `docs/pilot-plan.md` with 36 named realistic task slots, source/version-manifest fields, tuning/held-out source separation, positive/negative/ambiguous annotation examples and independent adjudication; verify synthetic cases supplement rather than replace realistic tasks and absent hashes/labels are marked pending rather than fabricated.
- [x] 2.2 Specify paired managed/native and semantic/frontier baseline procedures, literal-search reference, deterministic mechanics checks, three-run live protocol, freeze rules and downstream investigation accounting; verify both paths have equal declared evidence access and comparable limits without a deliberately weakened baseline.
- [x] 2.3 Specify metric denominators, overlap deduplication, unresolved handling, per-source reporting, sample minima, uncertainty and every numerical gate from the design; verify worked arithmetic examples distinguish failed gates, unknown prices and not-run measurements from passes.
- [x] 2.4 Document dry-run manifests, exact-model/evidence/spend authorization, credential prerequisites, retained-evidence privacy, remediation/held-out replacement and opt-in rollout/rollback; verify nothing in B authorizes live calls, publication, private-source transmission or a silent fallback.

## 3. Traceability and documentation integration

- [x] 3.1 Create `docs/semantic-acceptance.md` mapping every goal-B bullet and relevant baseline obligation to observable deterministic or evaluation cases and phase C–I owners; verify coverage of malicious evidence, non-Git scope, changes, long lines, partial capture, lifetime expiry, parent budget sharing and no-call re-filtering.
- [x] 3.2 Add README/document cross-links and dated status corrections to the conceptual baseline, execution contract/acceptance history and goal-progress record; verify no approved requirement is rewritten and implemented generic behavior is clearly separated from proposed semantic behavior and unmeasured benefits.
- [x] 3.3 Perform a documented cold-reader and requirement-by-requirement consistency review of the three documents against current source/main specs, with concrete end-to-end scenarios; resolve every implementation-blocking contradiction and record whether review was same-agent or independently delegated.

## 4. Verification and handoff

- [x] 4.1 Check all relative documentation links and JSON examples, run `npm run typecheck`, `npm test` and `openspec validate define-semantic-contract-and-pilot --strict`, and verify no runtime/dependency/default configuration files changed; record actual outputs without treating existing generic tests as semantic-quality evidence.
- [x] 4.2 Verify all tasks and deliverables on disk, reconcile actual documentation with this plan, update durable progress and archive this skip-specs documentation change without a spec merge; verify the dated archive and absence of the active change, then identify phase C and its separate proposal/apply handoff.
