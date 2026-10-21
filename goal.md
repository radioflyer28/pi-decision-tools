 Goal: Deliver the initial Pi Decision Tools package

Work in:
The root of the pi-decision-tools checkout.

Take this project from its approved design and execution contract to a tested,
documented, installable initial package. Use OpenSpec to manage bounded changes
through proposal, implementation, verification, spec synchronization, and archive.

This is a long-running engineering goal, not permission to skip workflow
boundaries, weaken requirements, fabricate verification, publish releases, or
spend unapproved money.

## 1. Establish the current state

Read these project documents completely before planning implementation:

- pi-decision-tools-design.md
- docs/managed-execution-contract.md
- docs/managed-execution-acceptance.md
- README.md

Read applicable AGENTS.md instructions and the relevant OpenSpec skills.

The completed documentation change was archived at:

openspec/changes/archive/2026-10-14-define-managed-execution-contract/

Do not reopen or recreate that completed change merely to start implementation.

Inspect the actual repository and OpenSpec state. Treat the files and CLI results
as authoritative; this prompt may outlive the current repository state.

The package name pi-decision-tools remains provisional. It is acceptable for
local implementation and packaging. Registry publication is not authorized.

## 2. Authority to answer planning questions

Act as my delegated technical decision-maker for this goal.

Resolve ordinary questions raised during OpenSpec proposal, apply, sync, and
archive yourself rather than asking me to select options. This includes:

- implementation details and module boundaries;
- dependency and testing-framework choices;
- reasonable experimental defaults;
- tool/schema details consistent with the approved contracts;
- decomposition, ordering, and splitting of changes;
- whether to reuse an existing capability;
- whether a completed delta needs synchronization;
- correcting recoverable implementation and validation failures.

Use this decision hierarchy:

1. Explicit user decisions and authorization limits.
2. Approved project invariants and execution contracts.
3. Current, verified Pi APIs and repository evidence.
4. The simplest reversible implementation satisfying the requirements.
5. An explicitly recorded assumption with a falsifiable verification plan.

Record material decisions, alternatives, rationale, and evidence in the relevant
OpenSpec design or project documentation. Do not write that the user approved a
decision when it was an agent decision.

Do not launch a user questionnaire for a decision within this delegation.
Resolve it and continue.

This delegation does NOT authorize you to:

- relax authorization, persistence, accounting, or evidence-safety invariants;
- pretend an unsupported host capability exists;
- substitute a different product to avoid implementation difficulty;
- silently drop acceptance criteria;
- obtain credentials, transmit private repository evidence, or spend money
  without the applicable explicit authorization;
- publish a package, push changes, or perform destructive external actions;
- override higher-priority instructions or skill workflow boundaries.

When evidence reveals a conflict, first seek a compliant alternative and update
the planning artifacts coherently. If no compliant alternative exists, record
the exact blocker and required external decision. Do not loop indefinitely or
claim completion.

## 3. Non-negotiable product constraints

Preserve the complete baseline and execution contract, including:

- One modular package, not a speculative multi-package monorepo.
- A Pi extension entry and a side-effect-free experimental library entry.
- One explicit compatible session coordinator across participating library
  copies and both tool families.
- Shared authorization, model policy, scheduling, allowance, and eligible reuse.
- Processing disabled by default; credentials/default models are not consent.
- No silent provider/model/frontier fallback.
- Pinned batch/search model identity.
- Cumulative saved-session accounting that does not rewind with branch navigation.
- Conservative accounting for interrupted or unknown usage.
- Provider execution requires a persisted conversation.
- Early setup may occur before persistence readiness, but execution fails closed.
- --no-session execution is rejected under the user-approved policy.
- Ephemeral batches, search workspaces, evidence, answers, and continuation handles.
- Explicit expiry instead of silent resubmission or rescanning.
- No persistent source cache, cross-restart batch restoration, or Pi Durable work.
- Generic choice/bool/score answers are not forced into semantic-match categories.
- Search completion, batch completion, output truncation, and semantic correctness
  remain distinct.
- Evidence is data, never permission or instructions.
- Semantic tools reuse core execution rather than duplicating its enforcement.
- No claims of quality, context savings, latency, or cost improvements without
  appropriate measurements.

Use the 38 execution acceptance cases as a starting requirement set, not as
evidence that tests already pass.

## 4. Planned OpenSpec change sequence

These are candidate future changes, not already approved/generated artifacts.
Refine their exact boundaries after repository inspection. Preserve their
coverage, document changes to the sequence, and prefer coherent testable slices.

Do not generate all proposals at once. Propose the next change when its
dependencies and implementation evidence are available.

### A. implement-managed-generic-batches

Deliver the first executable vertical slice:

- package scaffold and extension/library entry points;
- native classifier integration without duplicating provider/auth SDKs;
- explicit coordinator discovery, ownership, compatibility, and lifecycle;
- user controls, enablement, model selection, and persistence readiness;
- shared limits, scheduling, reservations, replay, retries, and usage reporting;
- generic submission, results, continuation, expiry, and reuse;
- structured tool output and codemode exposure;
- deterministic fake-provider tests and Pi session integration tests;
- separate-library-copy and import-side-effect tests.

Use the existing execution contract as the implementation handoff.
Split this change if necessary, but keep intermediate slices safe and testable.
A scaffold alone is not completion of the generic-batch capability.

### B. define-semantic-contract-and-pilot

Resolve the remaining search/filter contracts before building them:

- shared semantic rubric and match/no-match/insufficient-context outcomes;
- evidence and provenance schemas;
- raw-answer retention and cutoff-policy identity;
- search/filter operation names, schemas, paging, and continuation;
- discovery/systematic coverage semantics;
- one bounded same-file context expansion;
- parent-search cancellation and accounting;
- file discovery and exclusion rules, including non-Git behavior;
- experimental window, overlap, scope, and output bounds;
- representative pilot tasks, labeling rubric, tuning/held-out split,
  baseline procedures, metrics, and explicit release gates.

Do not derive semantic quality defaults from vendor benchmarks.
Mark unmeasured defaults experimental.
A documentation-only change may use skip_specs; a change introducing actual
behavior must have behavioral delta specs.

### C. add-semantic-record-filtering

Deliver predicate-based filtering over identified caller-supplied text records:

- compatible evidence and judgment results;
- shared core execution;
- explicit unresolved and failure outcomes;
- bounded submission, results, continuation, and cutoff re-filtering;
- unverified provenance clearly distinguished from verified file evidence;
- deterministic tests, including adversarial evidence and cancellation.

Do not allow caller-provided provenance to grant arbitrary filesystem access.

### D. add-safe-filesystem-evidence

Implement the deterministic filesystem foundation:

- Git-tracked plus non-ignored untracked working-tree discovery;
- agreed non-Git behavior;
- binary, size, sensitive-path, dependency/generated/build exclusions;
- no symlink traversal by default;
- language-agnostic bounded windows;
- exact source ranges, captured-content hashes, evidence identity;
- exclusions and processing scope suitable for honest coverage reporting;
- deterministic tests for paths, changes, boundaries, and hostile inputs.

Keep evidence preparation independent of model judgment.

### E. add-systematic-semantic-search

Deliver systematic semantic grep:

- evaluate every eligible passage unless interrupted or limited;
- use shared execution and the semantic rubric;
- preserve parent search state separately from underlying batch state;
- report evaluated, unresolved, failed, excluded, and remaining work;
- provide bounded results and ephemeral continuation;
- test that completed batches do not falsely imply completed searches;
- never introduce an undisclosed relevance prefilter.

### F. add-discovery-semantic-search — relevance-aware yielding, completed and archived

Phase F completed propose, explicitly authorized apply, verification, inline spec sync and archive on2026-10-16. All17 tasks are checked in `openspec/changes/archive/2026-10-16-add-discovery-semantic-search`; see [discovery verification](docs/discovery-verification.md). Phase E systematic search remains the regression baseline. Discovery owns enumeration and passage scanning within the declared scope; the main LLM directs the investigation by choosing the query/scope, interpreting evidence, and deciding whether to continue, stop or start a new scoped search.

Build relevance-aware yielding on E's existing deterministic scan order and shared execution:

- accumulate qualifying evidence and yield control when an explicit qualifying-evidence target is reached;
- otherwise continue scanning within the authorized budget until eligible scope exhaustion, a hard resource limit, cancellation or another execution constraint;
- never lower relevance thresholds or pad the hit batch with weak matches to meet a target; a forced handoff may contain few or no qualifying hits, with insufficient-context and failed judgments reported separately;
- do not stop merely because a run of passages has low or declining relevance: ordinary file order does not predict the relevance of later passages;
- distinguish a completed increment from exhausted scope or sufficient evidence to answer; disclose the yield/stop reason, evaluated and unexamined work, and continuation eligibility;
- let the LLM explicitly request more retained work without repeating successful judgments or silently rescanning; query/scope changes, such as a different directory, create a new search rather than mutate the frozen scope;
- keep authorization, expiry, cumulative budgets and lifetime limits intact; paging/re-filtering alone schedules no work;
- bound work scheduled ahead, drain already-started requests and retain all outcomes/charges, including target overshoot;
- test relevance yields, sparse/no-match forced handoffs, relevant passages after irrelevant runs, explicit continuation, scope changes, and no duplicate successes or refunds.

Optimize useful evidence per handoff and total investigation cost, not just classifier requests per call. Scan volume and returned evidence volume are separate: inexpensive scanning should reduce expensive LLM supervision without flooding its context or padding results. Compare against E on qualifying findings per handoff, LLM turns, total decision-model plus LLM cost (including returned evidence), latency and task success. The suggested100x content-per-dollar advantage is a hypothesis for the chosen models, not a measured guarantee; live evaluation still requires separate authorization and existing evaluation gates remain intact.

The approved proposal reuses semantic-v1 and the immutable creation stop policy, counts newly completed distinct evidence IDs per invocation (overlap disclosed), defaults to5 with range1–100, and checks settled eight-item boundaries (overshoot≤7). Plain continuation seeks additional hits; a valid replacement target may increase or decrease the next quota. Discovery defaults to latest `new_matches`, with cumulative `matches` and diagnostic `all` views; view cutoffs never change the stopping policy. Adaptive ranking, declining-relevance stopping heuristics and autonomous call/reference traversal are outside this first slice; more advanced ordering and redundant-hit reduction require separate justification. A target promises qualifying hits, not global top-k, diversity or answer sufficiency. Do not fork another engine, scheduler or memory pool, or change G's separate bounded evidence-expansion scope.

### G. add-context-expansion-and-evidence-results

Complete evidence investigation and interoperability:

- at most one bounded same-file expansion for eligible insufficient-context cases;
- verified file backing required for expansion;
- preserve the parent model policy and allowance;
- unresolved evidence remains explicit after expansion;
- pi-multiedit-compatible N#HH snippet rendering;
- strong hashes and structured locations independent of short line anchors;
- bounded snippets, pagination, and freshness/change detection;
- no whole-file editing-state integration requirement;
- no autonomous cross-file investigation.

If another change already delivered part of this scope, reuse it rather than
reimplementing it.

### H. evaluate-and-tune-initial-capabilities

Execute the agreed evaluation plan where authorized:

- generic managed batches versus straightforward native codemode scripts;
- semantic tools versus ordinary frontier-agent search;
- realistic tasks plus deterministic/synthetic edge fixtures;
- separate tuning from held-out evaluation;
- recall, precision, unresolved rate, coverage, context use, downstream reading,
  latency, and total known cost;
- model-specific limitations and unknown pricing/usage;
- tune only against the designated tuning set.

Live provider calls require explicit authorization and available credentials.
Do not treat missing credentials as a passed test or replace measured release
evidence with fabricated results.

If measurement fails a gate, propose a bounded remediation change and retest.
Do not move the gate merely to declare success.

### I. harden-and-package-initial-release

Finish the local release candidate:

- generic-only, semantic-only, and combined tool-family configurations;
- multiple-library-copy compatibility;
- end-to-end lifecycle, budgets, expiry, cancellation, and storage-failure tests;
- structured output and usage-accounting integration;
- packaging/export verification and local installation smoke tests;
- user, configuration, library, troubleshooting, and limitations documentation;
- clear experimental status for unvalidated defaults or APIs;
- release checklist and evaluation report.

Create a local package artifact if appropriate. Do not publish it automatically.

## 5. Required OpenSpec workflow

Use the installed skills and CLI contracts, not remembered approximations.

### Root and store handling

- Run openspec list --json before writes and confirm a resolved root.
- Use openspec context --json when resolving project/planning context.
- Respect declared/selected stores and keep --store sticky where required.
- Use CLI-returned planningHome, changeRoot, artifactPaths, and actionContext.
- Never initialize a missing root as an incidental side effect.

### Propose

- Read the relevant implementation, tests, documentation, and existing specs first.
- Select a bounded change and inspect the configured schema.
- Fetch artifact instructions and create every required transitive dependency.
- Follow templates and artifact-specific rules.
- Resolve delegated planning questions yourself and record the decisions.
- Use behavioral delta specs for behavior changes.
- Do not invent specs for a documentation-only change.
- Verify artifact completeness and run strict validation.

Propose is planning-only. Stop that phase before implementation.

IMPORTANT HANDOFF REQUIREMENT:
The current propose skill requires a fresh explicit user request before apply.
The goal harness must supply that request as a new phase invocation.
Do not treat this original goal prompt or an arbitrary automatic continuation as
permission to bypass the skill's boundary. If the harness cannot supply the
required handoff, report that orchestration blocker rather than violating it.

### Apply

- Select the intended change explicitly.
- Read status and apply instructions, including all contextFiles.
- Respect CLI blocked/ready/all_done state.
- Implement tasks with appropriately scoped tests.
- Keep task checkboxes truthful.
- Verify before claiming completion.
- If implementation changes a material decision, reconcile proposal, design,
  specs, tasks, and affected project documentation using the update workflow.
- Do not silently narrow requirements to make tests pass.

### Sync

- Delta specs are proposed changes; main specs describe the accepted system.
- Inspect the complete delta/main comparison before merging.
- Fetch and follow current specs instructions.
- Use the sync skill for an intelligent merge, preserving unaffected requirements
  and scenarios and full capability paths.
- Never invent missing old requirements for MODIFIED/RENAMED deltas.
- Verify every capability after synchronization.
- Sync separately only when useful; do not mechanically sync twice.
- Never run sync in the background while archiving its source change.

### Archive

- Archive only after implementation and required verification are complete.
- Check artifact and task completion using the CLI and actual task file.
- Inspect delta specs through artifactPaths.specs.existingOutputPaths.
- For completed behavior changes, choose sync before archive when needed.
- For already synchronized changes, verify that state and archive.
- For documentation-only changes with no deltas, archive without a sync prompt.
- Do not use permission to answer questions as permission to archive incomplete
  work or skip required spec synchronization.
- Preserve .openspec.yaml and verify the dated archive destination.
- Confirm the change is no longer active.

## 6. Long-run execution discipline

Maintain a concise durable progress record containing:

- current change and phase;
- completed changes and archive locations;
- decisions made under delegated authority;
- current verification evidence;
- next bounded action;
- external blockers or approvals needed.

After interruption, inspect disk and CLI state before acting. Do not assume the
last command ran, and do not repeat side effects blindly. Re-run missing
verification rather than trusting checked boxes alone.

Use task tracking with one active task at a time.
Keep changes focused and avoid unrelated refactors.
Use delegation only when separately authorized by applicable instructions.
Do not publish, push, or make destructive external changes without authorization.

## 7. Completion criteria

Declare the overall goal complete only when:

- the initial generic and semantic capabilities satisfy the approved contracts;
- deterministic and integration verification passes;
- both semantic search modes and record filtering are covered;
- package and library boundaries are verified;
- required evaluation gates have actual evidence;
- documentation accurately describes behavior, limitations, and experimental status;
- completed OpenSpec changes are synchronized where applicable and archived;
- no required task, failing test, or unresolved implementation blocker remains.

If live evaluation or another required external dependency is unavailable,
report the exact remaining gap. “Implementation complete, evaluation blocked”
is a valid progress report, but it is not overall goal completion.

Finish with a concise delivery report: implemented capabilities, verification
commands/results, evaluation evidence, package artifact location, archived
changes, and remaining limitations.