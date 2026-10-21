# Usage and integration

## User controls

| Command | Effect |
| --- | --- |
| `/decisions status` | Show authorization, persistence readiness, selected model, family switches, limits and cumulative ledger totals. No classifier call. |
| `/decisions enable [provider model-id]` | Select and authorize. With UI, confirm model/limits/transmission; without UI, ambiguity fails. An explicit unavailable model never falls back. |
| `/decisions disable` | Stop new dispatch, signal cancellation and await started promises. No refund for dispatched work. |
| `/decisions model [provider model-id]` | Select a classifier without enabling. Old batches remain pinned to their original model. |
| `/decisions default [provider model-id]` | Atomically save a default without enabling. |
| `/decisions replenish requests inputBytes` | Explicitly add safe-integer allowance without resetting spending or unknown usage. Interactive confirmation is required with UI. |
| `/decisions release handle` | Release an idle generic batch or `sem-…` parent and its owned children. It expires; allowance is unchanged. Busy work cannot be released. |

Model resolution uses an explicit selection, a valid saved default, the sole available classifier, or an interactive picker. No-UI ambiguity is `model_ambiguous`. A default that is no longer available is not a fallback authorization.

## Configuration

Only `<Pi user agent directory>/decision-tools.json` is read. There is no project override, credential storage or saved enabled state. Unknown fields/versions and invalid values fail closed.

```json
{
  "version": 1,
  "families": { "generic": true, "semantic": false },
  "limits": {
    "requests": 100,
    "inputBytes": 1048576,
    "concurrency": 2,
    "maxWorkMs": 10000,
    "maxAttemptMs": 5000,
    "maxRetries": 1
  }
}
```

Optional `fileExclusions` is an array of 0–256 unique relative file/directory paths (each <=4096 UTF-8 bytes), for example `["private", "notes/local.txt"]`. It only adds exclusions to the [internal filesystem foundation](filesystem-evidence.md); it cannot bypass built-in safety rules, enable execution or make record provenance readable. Existing record tools do not acquire source files. Saving a model default preserves this setting. Remove the field before rolling back to an older strict configuration parser.

An optional `defaultModel` is `{ "provider": "provider-id", "id": "model-id" }`. Defaults and bounds are experimental, not measured optimal settings. The initial persisted grant freezes policy ceilings; later config edits/re-enablement do not enlarge that session's allowance. Explicit replenish adds units, not new policy ceilings.

Generic-family disablement hides generic tools and rejects their direct/internal execution. Library consumers are independent of family visibility but still require shared authorization, model/persistence gates and allowance. Set `families.semantic` to true and reload to expose five semantic operations for [records](semantic-usage.md) and [systematic file search](search-usage.md); set `families.generic` to false for semantic-only use. Semantic-family execution is independently enforced even for hidden/internal calls. Reload expires existing handles and requires fresh session enablement. All eight definitions remain registered, including semantic_search; unsupported discovery/expansion arguments reject.

Noninteractive initial startup requires all three flags: `--decisions-enable`, `--decisions-model 'provider/model-id'`, and `--decisions-budget '<full limits JSON>'`. Split the model at its first slash; model IDs can contain slashes. Flags are consumed only on the initial startup event, never reapplied on resume, reload, fork or replacement. Existing sessions cannot get a second initial grant from flags.

## Generic calls

Example submission (synthetic evidence):

```json
{
  "items": [{ "id": "note-1", "inputVersion": "v1", "state": { "text": "The maintenance window starts at noon." } }],
  "rubricVersion": "schedule-v1",
  "questions": {
    "hasTime": {
      "type": "bool",
      "instructions": "Does this note state a maintenance start time?",
      "criteria": { "true": "A start time is stated.", "false": "No start time is stated." }
    }
  },
  "run": { "maxRequests": 1, "maxInputBytes": 4096, "maxWorkMs": 5000 }
}
```

Omit `run` to prepare without invoking a classifier. Submission still requires enablement. Retain the returned `batchId` and immutable `identity`:

```json
{ "batchId": "RETURNED_BATCH_ID", "expectedIdentity": "RETURNED_IDENTITY", "run": { "maxRequests": 1 } }
```

Continue processes pending items only by default. Add `retryFailedIds` only for failures marked retry-eligible; invalid/duplicate/successful/exhausted selections reject the entire request. Attempts, including retries across continuations, are limited to `1 + maxRetries` per item. Automatic retry requires observed structured transient HTTP status; error prose never authorizes it. No provider/model fallback exists.

Choice answers retain labels and probabilities; boolean answers retain probability; score answers retain score and confidence. Declared choice abstention labels in `abstainChoices` become completed abstentions, not failures. These are structural guarantees, not semantic correctness or calibrated confidence. Mismatched provider/model identity fails; reported usage is retained under `unknown/unknown` rather than echoing unverified identity text or attributing it to the pinned model.

Retrieve with `{ "batchId": "RETURNED_BATCH_ID", "limit": 20 }`, then pass `page.nextCursor` as `cursor`. Pages preserve item order, contain at most 100 items and fit a 128 KiB envelope. A run changes revision; earlier cursors fail `cursor_stale`. Restart retrieval from the first page. Busy retrieval fails explicitly.

## Library boundary

Import has no host side effects. Lazily connect inside your own extension tool/command after the owner's session startup has finished:

```typescript
import { connect, type Submit } from 'pi-decision-tools';

// Inside an existing tool execute handler, with Pi's pi/ctx and this call's signal:
const client = connect(pi, ctx);
const result = await client.submit(input as Submit, signal ? { signal } : {});
// Map result.data to your tool's structuredContent and inspect result.data.ok.
// Report result.usageDelta once through that tool's usage field, if present.
```

Do not discover during module import, create an independent executor, or cache authority across replacement/reload. Reconnect after `runtime_expired`. If a nested tool call already reported usage through Pi, do not report the same delta again in its parent. Cumulative `value.usage` and ledger totals are data, not fresh usage charges.

## Persistence, cancellation and limits

One request unit is one native classifier invocation for one item and all questions. Input bytes are canonical UTF-8 `{state,questions}` for every attempt; these are not tokens or wire bytes. Native SDK retries are requested as zero, but provider-internal behavior cannot be promised as a hard HTTP-request count. Unknown pricing is not free execution.

A normal persisted user/assistant message must already exist before execution. The toolkit writes only normal Pi custom ledger entries and verifies them on disk before dispatch. It does not fabricate conversation messages or create a fallback journal. All branches contribute to allowance; unresolved reservations stay fully charged after crashes. Read-back is not an fsync/power-loss guarantee, and the file has one host writer.

Cancellation is cooperative. An unresponsive native promise retains its scheduler slot until it settles; elapsed time may exceed the deadline. Work never becomes a detached background job. Disable does not refund started calls. Navigation expires workspaces after draining; cancelled navigation keeps handles but leaves processing disabled. Compaction alone preserves the current workspace; reopen does not.

Hard experimental bounds: 128 items, 16 questions, 32 criteria, 128 UTF-8 bytes per identifier, 64 KiB input per item, 1 MiB submitted batch, 32 live batches, one shared 8 MiB retained/reserved ceiling covering generic data, semantic parents and their children, and 64 KiB answers per item. Release idle workspaces on `workspace_full`; nothing is silently evicted or resubmitted.

## Troubleshooting and privacy

- `disabled`: explicit user enablement is needed; credentials are insufficient.
- `persistence_required`: start a normal saved conversation. `--no-session` cannot execute.
- `storage_error`: stop using that runtime. Repair/reopen a consistent saved session; re-enable alone cannot clear the fault. Do not delete ledger entries to reset spending.
- `model_policy_mismatch`: select the originally pinned model or explicitly submit a new batch.
- `batch_expired` / `search_expired` / `runtime_expired`: old handles/facades cannot be restored. A new submission is new work charged to remaining cumulative allowance.
- `coordinator_unavailable`: load the extension and wait for its session startup before connecting.
- `coordinator_incompatible` / `coordinator_conflict`: remove incompatible/duplicate owners; there is no independent fallback execution domain.

State, questions, answers, raw provider exception text and endpoints are not written to toolkit ledger/diagnostics. Inputs and results may still appear in ordinary Pi transcripts and codemode output. Submitted evidence is data, never permission to enable tools, change limits, read files or select a different provider.
