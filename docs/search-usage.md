# Use systematic and discovery file search

For operators who want predicate-based search over project files, with explicit uncertainty and bounded continuation. Systematic mode scans within explicit limits; discovery yields qualifying evidence. Neither claims calibrated relevance, repository-wide understanding or measured savings.

## Authorize and choose scope

Enable `families.semantic` in the user [configuration](usage.md#configuration), reload, then explicitly run `/decisions enable <provider> <model-id>`. A saved conversation is required before classifier dispatch. Source text is sent to that selected provider when execution is requested; preparation alone makes no provider calls. Normal Pi transcripts may retain tool inputs/results.

The host supplies the project root and additive `fileExclusions`. Tool arguments cannot replace either or bypass [capture safety policy](filesystem-evidence.md). Git scopes enumerate tracked and non-ignored untracked working-tree files; omitting scope searches eligible Git files. Outside Git, specify regular files explicitly; directory/implicit traversal fails `git_required`.

Pass this preparation request to `semantic_search`, replacing the example path with an existing project-relative file:

```json
{
  "predicate": "Cancellation is checked before work is scheduled.",
  "mode": "systematic",
  "scope": { "paths": ["src/worker.ts"] }
}
```

Omitted mode also means systematic. Scope admits up to256 unique normalized paths of4096 UTF-8 bytes each. Predicate maximum is2048 UTF-8 bytes. Priorities, expansion controls, caller roots and unknown fields reject. `targetMatches` is accepted only with explicit discovery mode (not systematic or record filtering). Invalid requests or missing authorization fail before source acquisition.

## Discovery: useful evidence per increment

Prepare or execute discovery explicitly. This example executes with a per-invocation target of five and an experimental creation cutoff; neither number is a calibrated quality default:

```json
{"predicate":"Cancellation is checked before work is scheduled.","mode":"discovery","scope":{"paths":["src/worker.ts"]},"targetMatches":5,"policy":{"version":1,"minMatchProbability":0.8},"run":{"maxRequests":64}}
```

The target defaults to5, range1–100. Only explicit matches meeting the **immutable creation `stopPolicy`** qualify. Counts are newly completed distinct evidence IDs in this invocation, including successful explicit retries or eligible reuse; overlapping windows count separately, not as independent sources. Failed, insufficient-context and below-cutoff outcomes never pad a quota. The default policy cutoff remains0 if omitted; select a meaningful cutoff deliberately.

Discovery uses the same path/range order and eight-passage children as systematic. It checks the target only between settled children: up to7 qualifying overshoot is retained and charged. It does not dispatch the next child after meeting the target. Sparse/late/absent relevance does not stop a scan early. Execution constraints take precedence, and full processing reports `complete`; constrained acquisition stays incomplete. A target yield proves neither exhaustive coverage, top-k ranking, diversity nor answer sufficiency.

An ordinary continuation seeks **additional** evidence without repeating successes. Omit target to retain the last per-invocation quota, or replace it with any1–100 value (including a smaller one):

```json
{"operationId":"sem-RETURNED_HANDLE","expectedIdentity":"0000000000000000000000000000000000000000000000000000000000000000","targetMatches":3,"run":{"maxRequests":64}}
```

Discovery automatically returns `view: "new_matches"`: qualifying judgments from the latest accepted execution, under the selected view cutoff. `yieldProgress.matched` always uses the creation stop policy; re-filtering cannot change it. A valid zero-dispatch invocation clears the latest increment, not historical findings. Invalid identity/target/retry requests change nothing. Prepare-only discovery has no new matches yet.

```json
{"operationId":"sem-RETURNED_HANDLE","view":"matches","limit":100}
```

Use `matches` for cumulative qualifying findings or `all` for the full pending/failed/unresolved/raw history. These selectors are discovery-only. All views retain full coverage, outcome totals, diagnostics, usage and ledger; empty items do not imply no remaining work. Paging or re-filtering never resumes execution. The LLM chooses whether to continue, stop or create a new search with a new query/directory scope; discovery does not follow code relationships.

## Execute and continue retained evidence

Add `run` to the initial search to execute, or pass its returned handle and identity to `semantic_continue`. Both placeholders below must be replaced:

```json
{
  "operationId": "sem-RETURNED_HANDLE",
  "expectedIdentity": "0000000000000000000000000000000000000000000000000000000000000000",
  "run": { "maxRequests": 8, "maxInputBytes": 65536, "maxWorkMs": 10000 }
}
```

Inspect `ok` first; failures can carry `partial` results. Systematic mode considers every eligible captured passage in UTF-8 path/range order, without a vocabulary prefilter or target-match early stop. Discovery uses that order but can yield at a qualifying target. Capture time counts against the invocation deadline; classifier requests/input bytes use one decreasing allowance across eight-item children. Generic callers share session limits and scheduler capacity but do not consume this invocation's local ceiling.

Continuation never rescans. Changed or deleted current files cannot replace retained pending inputs, and successes are not repeated. To retry, use only returned retry-eligible evidence IDs in `retryFailedEvidenceIds`; an invalid mixed selection rejects atomically and lifetime attempt limits remain. Model-policy changes stop dispatch without fallback. Start a new search deliberately if you want new source bytes.

## Interpret coverage, not just matches

- `coverage.initial` partitions total passages into judged, failed, pending and running. `outcomeCounts` separates match, noMatch and unresolved judgments; failure is never a negative.
- `complete` requires complete capture **and** every initial passage judged or failed. Failures/insufficient context can coexist with completed processing.
- `coverage.enumeration`, `files`, `excludedRanges` and complete reason totals describe acquisition independently. Detail lists may be trimmed with `exclusionsTruncated: true`.
- `scope_limit` or acquisition `workspace_full` remains incomplete even after retained work settles. `continuation.canResume: false` with incomplete scope means use a narrower new search, not repeated continuation to acquire missing files. Unknown remaining counts are null, not zero.
- A complete zero-window scope makes no classifier calls. Exclusions or incomplete capture never prove an exhaustive semantic negative.

## Read historical results and check freshness

Use `semantic_results` as for [record views](semantic-usage.md#3-read-or-change-a-view-without-calls): default20/max100 items,128KiB per envelope. Repeat the same policy, discovery view selector and limit with the next cursor. Execution changes revision (`cursor_stale`); other parents, policies or limits reject incompatible cursors (`cursor_invalid`). Cutoff views do not rerun judgments or spend allowance.

File items retain root/snapshot/path, original inclusive line ranges and full-file/passage hashes. `semantic_evidence` accepts owned evidence IDs and optional `checkCurrent: true`. Freshness is captured/unchanged/changed/missing/unverifiable; it never replaces historical text or calls a model. A record's claimed path remains unreadable/unverified.

Plain snippets default to20 lines/2KiB; explicit retrieval permits100 lines/16KiB within the envelope cap. Original bytes, including BOM and CRLF, determine hashes; only display text drops a leading BOM at byte zero. Whole-line truncation may yield an empty snippet and nonadvancing offset: request a larger byte bound, not an endless loop. Oversized responses return `output_limit`; request fewer evidence IDs or smaller snippets. No N#HH anchors or context expansion are produced.

## Resource lifetime and recovery

Eight semantic parents (including pending capture admissions),32 live core batches and8MiB retained/reserved accounting are shared with generic/record work. This is not a JavaScript heap limit. Settled nonretryable search children can retire after their outcomes/usage are copied, so32 slots do not impose a permanent256-passage ceiling. Retryable children remain live; other work can still legitimately exhaust capacity.

`/decisions release sem-…` frees an idle parent, capture and owned children without refunds. Busy release fails `search_busy`. Disable drains active work and leaves historical results readable. Current-file checks hold a read lease so expiry cannot free their capture mid-read. Compaction preserves progress; successful navigation/reload/reopen expires handles. No persistent evidence cache or automatic replay exists.

Discovery's target and cutoff defaults are experimental. See [offline comparisons and the separately authorized live procedure](discovery-evaluation.md) and [discovery verification](discovery-verification.md). Scripted handoffs are not measured LLM turns, and no quality/cost/100× improvement is claimed. Expansion/hashlines remain G; live quality/savings evaluation H; release hardening I. Safe capture is neither comprehensive secret detection nor an OS sandbox against hostile concurrent filesystem mutation. See [verification and security scope](search-verification.md).
