# Use semantic record filtering

For Pi users who want to filter **already supplied text**, retain explicit uncertainty and investigate the captured evidence. Record filtering does not discover or open files. For the separate authorized filesystem operation, see [systematic search](search-usage.md). Probabilities and default cutoff zero are experimental, not measured accuracy guarantees.

## 1. Enable the family and authorize a session

In the user-agent `decision-tools.json`, set `families.semantic` to true; keep `families.generic` true for both families or false for semantic-only tools. Use the complete [configuration example](usage.md#configuration), retaining finite limits. Reload Pi, start a normal saved conversation, then run `/decisions enable <provider> <model-id>`. Reload invalidates old handles and never restores previous authorization automatically.

Credentials, family visibility and saved model selection do not authorize execution. An authorized preparation can occur before persistence is ready, but a classifier call requires a persisted conversation; `--no-session` fails closed. Submitted text is transmitted to the selected provider. Tool arguments/results may also enter normal Pi transcripts.

## 2. Submit identified records

Pass this synthetic example to `semantic_filter`:

```json
{
  "records": [
    { "id": "a", "text": "The maintenance window starts at noon." },
    { "id": "b", "text": "A maintenance window is planned, but its time is unknown." }
  ],
  "predicate": "The record states a definite maintenance start time.",
  "run": { "maxRequests": 1, "maxInputBytes": 8192, "maxWorkMs": 5000 }
}
```

Omit `run` to prepare without classifier work. Inspect `ok` first; an error can carry available `partial` data. Keep the returned `operationId` and `identity`. The one-request example normally leaves the second record pending unless eligible reuse already exists. Shared session spending can stop it earlier.

Each judged item retains its original record ID, captured-text hash, raw native answer and provider/reuse origin. Raw `match` at or above the selected match-probability cutoff becomes `match`; below it becomes `unresolved/below_cutoff`. Raw `no_match` stays negative. Raw `insufficient_context` stays `unresolved/insufficient_context`. Operational failures are `failed`, not negative judgments. A complete operation has no unattempted records but may contain failures or unresolved outcomes.

## 3. Read or change a view without calls

For `semantic_results`:

```json
{ "operationId": "sem-RETURNED_HANDLE", "limit": 20, "policy": { "version": 1, "minMatchProbability": 0.8 } }
```

Replace the example handle with the actual value. This policy changes only the requested view, not the retained creation policy or raw answers. Default cutoff is zero (label-only), not a calibrated confidence threshold. Multiple views can coexist. Use `page.nextCursor` to continue, repeating the same policy and limit. Omitting policy selects the creation policy. Continuation changes revision; old cursors fail `cursor_stale`, and wrong policies/limits fail `cursor_invalid`.

Read-only results and snippets are allowed while processing is disabled. They make no classifier calls and emit no fresh usage. Cumulative `usage` and `ledger` fields are data; do not report them again as tool usage.

## 4. Continue only remaining work

For `semantic_continue`:

```json
{ "operationId": "sem-RETURNED_HANDLE", "expectedIdentity": "0000000000000000000000000000000000000000000000000000000000000000", "run": { "maxRequests": 1 } }
```

Replace **both** placeholders: the zero hash is schema-valid notation, not an executable identity. Normal continuation runs pending records only. To retry failures, add `retryFailedEvidenceIds` containing returned **evidence IDs**, not caller record IDs. Every selected item must be a retry-eligible failure with remaining lifetime attempts; one invalid ID rejects the whole selection before mutation. Successful records are not repeated.

All children and retries share one decreasing invocation request/byte budget and one work deadline, in addition to session ceilings. No new child restores a lower allowance. Parent model identity is immutable; `model_policy_mismatch` requires restoring the original selection or deliberately submitting a new operation.

## 5. Inspect captured evidence

For `semantic_evidence`:

```json
{ "operationId": "sem-RETURNED_HANDLE", "evidenceIds": ["ev-RETURNED_EVIDENCE_ID"], "startOffsetLines": 0, "maxLines": 100, "maxBytes": 16384, "checkCurrent": true }
```

Use the actual evidence IDs. Every record snippet has `format: plain`, null file path/line ranges and `freshness: unverified`. Optional caller label/path/line provenance is retained as a claim only. Even `checkCurrent: true` does not read a path, establish freshness, grant filesystem permission or expand context.

Snippets preserve whole lines. Default item snippets allow 20 lines/2 KiB. A longer first line can produce empty text with `truncated: true` and a nonadvancing offset: request a larger byte bound instead of looping at the same bound. At the hard limit, `output_limit` is explicit. This is not N#HH editing evidence.

## 6. Compose in codemode

After explicit enablement, this synthetic script demonstrates preparation, bounded continuation and a zero-call view. It does not enable itself:

```javascript
const prepared = await tools.semantic_filter({
  records: [{ id: "note", text: "The maintenance starts at noon." }],
  predicate: "A definite start time is stated."
});
if (!prepared.ok) return prepared;
const executed = await tools.semantic_continue({
  operationId: prepared.value.operationId,
  expectedIdentity: prepared.value.identity,
  run: { maxRequests: 1 }
});
if (!executed.ok) return executed;
return await tools.semantic_results({
  operationId: executed.value.operationId,
  policy: { version: 1, minMatchProbability: 0.8 }
});
```

The executing semantic wrapper reports only its own native usage. Pi aggregates nested usage; scripts and parent tools must not add cumulative result usage again. There is no public semantic library facade; the experimental library remains the generic batch API.

## Bounds and safe recovery

- 1–128 records; IDs up to 128 UTF-8 bytes; text up to 16 KiB each; predicate up to 2 KiB; complete canonical submission up to 1 MiB. Provenance strings are at most 512 bytes and paired positive line ranges must be ordered.
- At most eight parents, sharing the **same** 8 MiB retained/reserved ceiling and 32 core-batch slots as generic work. Children contain up to eight records and are retained for retry/reuse integrity. One 128-record parent can occupy 16 child slots. Capacity failure may leave a partial parent with `workspace_full`; nothing is silently evicted or rebuilt.
- Results default to 20/max 100 items with a 128 KiB whole-envelope limit. Evidence selects 1–20 IDs, at most 100 lines/16 KiB per snippet, under the same envelope cap.
- `/decisions release sem-…` releases an idle parent and its children without refunding or resetting charges. It does not release unrelated work or replenish allowance. Busy release fails `search_busy`.
- Disable closes admission, aborts active parents and drains actual promises. An abort-ignoring provider keeps its slot and liability until settlement. Re-enable does not automatically retry failures.
- Successful navigation/reload/reopen expires handles (`search_expired`); cancelled navigation retains them but leaves processing disabled. Compaction alone preserves them. No automatic replay/rescan occurs.
- For persistence/storage/model faults use [troubleshooting](usage.md#troubleshooting-and-privacy). Never delete ledger history to regain allowance.

**Separate operation:** [semantic_search](search-usage.md) provides systematic filesystem search. **Not available:** discovery mode, context expansion and N#HH rendering. See [contract](semantic-contract.md), [acceptance coverage](semantic-verification.md) and [unrun pilot gates](pilot-plan.md). Passing fake-provider tests does not prove semantic quality or a release gate.
