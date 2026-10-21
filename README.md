# Pi Decision Tools

**Experimental generic batches, record filtering and systematic file search implemented.** The package name is provisional. The full initial product and release gates are not complete, and nothing has been published.

One Pi package manages bounded native-classifier batches: typed choice/bool/score answers, partial results, continuation, shared authorization and scheduling, eligible reuse, and cumulative saved-session limits. Generic tools, semantic record tools and participating library copies use one session owner.

Five semantic tools provide record filtering and [systematic and discovery file search](docs/search-usage.md), disabled by the semantic-family default. Search uses the [safe filesystem-evidence foundation](docs/filesystem-evidence.md) only on explicit authorized requests. Discovery yields qualifying evidence in bounded increments; context expansion is **not implemented yet**. Phase F is verified and archived; see [discovery evidence](docs/discovery-verification.md). Semantic quality, context savings, latency, and cost improvements remain unmeasured.

## Build and load locally

Requires Node >=22.19.0. Development currently targets Pi 1.2.0.

```powershell
npm ci
npm run typecheck
npm test
pi -e ./dist/extension.js
```

The test command builds first. It uses isolated temporary sessions, a credential-free environment, blocked network entry points, and fake classifiers. It does not run a live provider test. See [development notes](docs/development.md) for the approved narrow Pi dependency release-age exception.

After loading:

```text
/decisions status
/decisions enable <provider> <model-id>
```

Execution starts **disabled**. A saved default or credentials are not consent. Interactive enablement confirms the selected classifier, limits, and evidence-transmission warning. Provider execution requires an already persisted conversation: early preparation is allowed, but pre-conversation and `--no-session` execution fail closed.

## Interfaces

- `decision_submit`: prepare an ephemeral batch, or execute it with explicit per-call limits.
- `decision_results`: retrieve bounded structured pages without provider work.
- `decision_continue`: continue pending items or explicitly select eligible failed items for retry.
- `semantic_filter`: prepare or judge identified text records with explicit unresolved/failure outcomes.
- `semantic_search`: prepare or systematically judge safely captured project-file passages, with explicit scope/processing coverage.
- `semantic_results`: page or change the cutoff over retained raw judgments without new calls.
- `semantic_continue`: resume retained pending records/file passages or explicitly retry eligible failures.
- `semantic_evidence`: retrieve plain historical snippets; optional freshness checks read only owned captured files, never caller record provenance.
- Experimental library: `import { connect } from 'pi-decision-tools'`; connect explicitly inside a tool/command after session startup. Import alone does no host discovery or execution.

All tools expose structured envelopes; inspect `ok`, per-item outcomes, and `stopReason`. A complete batch can contain failures. Pagination truncation is not incomplete execution. Each family has independent codemode/hidden exposure; visibility is not authorization. A complete record operation can include failures or unresolved judgments and does not imply semantic correctness.

## Documentation

- [Usage, configuration and library integration](docs/usage.md)
- [Record filtering, continuation and zero-call views](docs/semantic-usage.md)
- [Systematic file search and safe continuation](docs/search-usage.md)
- [Search requirement and security verification](docs/search-verification.md)
- [Record acceptance coverage and remaining scope](docs/semantic-verification.md)
- [Opt-in native smoke procedure](docs/native-smoke.md) — not run as part of this implementation
- [Verification map and remaining audit work](docs/verification.md)
- [Managed execution contract](docs/managed-execution-contract.md)
- [Acceptance requirements](docs/managed-execution-acceptance.md)
- [Conceptual design baseline](pi-decision-tools-design.md)
- [Semantic contract — records/systematic/discovery search implemented; expansion planned](docs/semantic-contract.md)
- [Semantic acceptance and phase ownership](docs/semantic-acceptance.md)
- [Pilot procedures and release-evidence gates — not yet run](docs/pilot-plan.md)

Batches, answers, reuse entries and cursors expire with runtime/generation changes. The accounting ledger persists across branches and does not refund unknown/interrupted attempts. Toolkit diagnostics and ledger exclude raw evidence, but ordinary Pi tool arguments/results can still enter the session transcript. Do not submit sensitive evidence without appropriate authorization.
