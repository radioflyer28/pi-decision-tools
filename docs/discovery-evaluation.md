# Discovery operational comparisons and live evaluation procedure

## What this establishes

Phase F's offline fixture harness uses real filesystem capture, retained parents, scheduler, ledger, pages and continuation, with **predetermined native responses**, not a semantic model. It tests operational behavior, not relevance accuracy or investigation success. No provider spending, credentials, private-source transmission or publication is involved. Target5 and the fixture cutoff0.8 are experimental choices; default runtime cutoff remains0.

Reproduce after a clean build:

```powershell
npm run build
node scripts/test.mjs filesystem-discovery-evaluation --details
```

The runner isolates configuration/credentials/network and prints eight `DISCOVERY_OPERATIONAL` JSON records. Each pair uses identical synthetic source text/window boundaries, semantic-v1, cutoff0.8, concurrency1, requests100/inputBytes1MiB and a per-call ceiling64. There are32 windows, except the16-window overlap case. All are64-line windows with up to8-line overlap. Responses are prescribed by window index: dense all matches; sparse every sixth; late last eight; absent negatives; insufficient all insufficient; below-cutoff matches with0.5 probability; failed every eighth plus negatives; overlap all matches. There is no lexical gate. Each mode runs in a fresh actual session, without cross-run reuse.

The controller exhausts each scope, reading every result page before continuation. It emits only qualifying `{id,source,snippet}` objects for **both** modes. Therefore tool-envelope volume is not assumed to equal frontier-visible volume. Initial handoff metrics show the starting-evidence trade-off; exhaustive metrics expose the cost of continuing rather than assuming the first yield solved a task. Every qualifying ID must be recovered exactly once. Adjacent/overlapping same-path intervals are merged for source-span/covered-line counts: these are geometric counts, not independently validated findings or source diversity.

## Observed fixture snapshot

bg-34 on Windows passed all8 comparisons. Numbers below are that observed run, not a timing guarantee; later runs can differ in elapsed time and small diagnostic-envelope sizes.

| Fixture | First calls E/F | First qualifying IDs E/F | Merged spans E/F | First envelope bytes E/F | First latency ms E/F | Exhaustive handoff proxy E/F |
| --- | --- | --- | --- | --- | --- | --- |
| dense |32/8|32/8|1/1|58836/16115|1342/505|1/4|
| sparse |32/32|6/6|6/6|58992/12544|1181/1161|1/1|
| late |32/32|8/8|1/1|58989/16143|1201/1255|1/1|
| absent |32/32|0/0|0/0|59037/1856|1173/1149|1/1|
| insufficient |32/32|0/0|0/0|60061/1856|1189/1184|1/1|
| below cutoff |32/32|0/0|0/0|59453/1856|1170/1183|1/1|
| failed |32/32|0/0|0/0|57393/1856|1155/1108|1/1|
| overlap |16/8|16/8|1/1|30275/16114|646/493|1/2|

First controller-emitted evidence bytes E/F: dense24657/6144; sparse4621/4621; late6185/6185; overlap12296/6144; all zero-hit cases2/2 (`[]`). Dense covered source lines are1800/456; sparse384/384; late456/456; overlap904/456. All fixtures deliberately share one file, so none demonstrates independent-source diversity.

Exhaustive classifier calls are equal in each pair (32, or16 for overlap). Known **fake** usage is320 tokens per32-response run,160 for overlap, and280 plus4 unknown-usage attempts for the failed case. These are adapter accounting fixtures, not measured model token consumption or known free work. Detailed JSON additionally records charged logical input-byte units, new versus repeated emitted evidence-object bytes, total tool-envelope volume and exhaustive elapsed time. Repeated qualifying evidence bytes must be0; array framing is included in first emitted payload bytes but not the summed individual-object counter.

Interpretation: dense starting evidence arrived after8 rather than32 judgments, but exhaustive discovery required4 rather than1 scripted handoffs and64540 rather than58836 total envelope bytes. Sparse and late cases did not save classifier calls. Programmatic filtering makes emitted evidence equal on sparse/late/empty cases even though native tool envelopes differ substantially. **No blanket reduction in LLM turns, total cost, context, latency or task failures follows from these fixtures.** Actual LLM turns, pricing, semantic quality and task success remain explicitly null/unmeasured. The suggested100× content-per-dollar ratio is an untested hypothesis.

The expanded reporter also passed8/8 in bg-35 after the runtime boundary audit fix. Charged logical input-byte units were64761 for every exhausted32-window run,32364 for overlap, and16180 at the first dense/overlap discovery yield. Exhaustive new emitted evidence-object bytes were equal E/F: dense24624, sparse4614, late6176, overlap12279, and0 for each zero-hit case. Repeated emitted evidence-object bytes were0 in **every** mode/case. These counters are logical managed input/serialized evidence units, not provider tokens or actual LLM context. bg-35 dense first latency was1363/504ms and total latency1376/1197ms; its exhaustive envelope totals58845/64521 again show that early useful yielding does not guarantee cheaper exhaustive reporting.

## Separately authorized paired live procedure

No live run is authorized by this document. Phase H's [pilot plan](pilot-plan.md) remains authoritative and unchanged.

1. Resolve and hash the approved tuning/held-out snapshots and labels; obtain explicit source-transmission consent, classifier/frontier identities, credentials supplied by the operator and finite spend/iteration/concurrency limits. Produce the pilot's dry-run manifest with worst-case attempts, retries, logical input bytes, downstream frontier bounds and known pricing. Missing consent/credentials/prices are not inferred grants.
2. Tune/freeze only on the tuning tasks: predicate/rubric/windows, cutoff, target5/per-call counting, controller policy, retry policy and useful-view selection. Do not retune on held-out results or lower cutoffs to fill a quota. Disclose the difference between geometric overlapping IDs and adjudicated gold spans.
3. Run three paired repetitions per condition in fresh sessions, alternating E/F order and disclosing warm/cache effects. Use identical captured corpus, task, model identities, quality cutoff and finite budgets. Compare systematic and discovery against the pilot's literal/frontier/record baselines where applicable. Give each a competent bounded controller; do not force E into one-window calls or count parallel baseline work as free.
4. For every invocation record useful supported IDs and adjudicated deduplicated spans, pending/failed/unresolved coverage, new/repeated returned bytes and tokens, actual frontier-visible inputs, actual LLM turns/tool rounds, native attempts/retries/logical input units, known usage/pricing and unknown counts. Include downstream source reads, relationship-following and final answer work. Measure end-to-end/p95 latency and independently adjudicated task success; a target yield is not task success. A controller handoff is not automatically an LLM turn.
5. Calculate total known classifier **plus** frontier/retrieval/downstream cost with unknown amounts kept unknown. Compare paired first-useful-evidence and whole-task results; do not substitute token ratios or catalog zero prices for total cost. Include failed/incomplete runs and predefined retry costs, without cherry-picked reruns.
6. Retain every existing gate:24 held-out tasks (≥8/source),≥100 positive spans,≥6 no-match tasks; systematic recall≥.90, precision≥.80, per-source recall≥.80, unresolved≤.25; discovery usefulness within five results≥.80 and negative rejection≥.80; median total frontier evidence-token ratio≤.75 including downstream reads; median end-to-end latency ratio≤2.0 with success not below baseline; three paired runs and full integrity/provenance/unknown-count reporting. Target overshoot is not permission to replace the pilot's five-result metric with an easier eight-result denominator.
7. Publish a gate-by-gate pass/fail/unverified report with manifests, labels, versions, all paired denominators and attribution limitations. Failed tuning/gates require bounded remediation, not weakened acceptance. F runtime/package verification does not satisfy H's quality/cost gates or I's release-readiness gate. Expansion/hashlines remain separate Phase G work.
