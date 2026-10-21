# Tasks

## 1. Package and contract primitives

- [x] 1.1 Add the single ESM package manifest, strict TypeScript build/declaration configuration, npm lockfile, host peer/development dependencies, and explicit extension/library exports; verify clean installation and build/typecheck without bundling host modules.
- [x] 1.2 Implement shared data types, exact tool schemas, canonical JSON validation, UTF-8 bounds, and identity hashing; verify EX-10/14/16 tests including Unicode, cycles, nonfinite numbers, own-key/prototype safety, and post-submission mutation.
- [x] 1.3 Add instrumented fake classifier, fake clock/signal helpers, and isolated session/config fixtures; verify tests cannot access real credentials or send provider network requests by default.

## 2. Persistent accounting and controls

- [x] 2.1 Implement validated grant/reserve/settle/release event reduction and all-branch current-session replay; verify EX-24/25/27/30 tests for unknown versions, duplicates, overflow, invalid transitions, and inherited foreign-session entries.
- [x] 2.2 Implement the Pi persisted-conversation/read-back adapter and latched storage faults; verify EX-05/28/29 with actual temporary SessionManager files, buffered custom-only entries, missing storage, partial append/read-back failure, and proven non-dispatch release.
- [x] 2.3 Implement authorization, frozen user limits, model discovery/selection/pinning, and per-attempt gates; verify EX-01/02/03/22/23 with zero native calls on failed preflight and no automatic fallback or grant reset.
- [x] 2.4 Implement validated user configuration and atomic default saving; verify EX-38 malformed-config and failed-write tests preserve old configuration and do not enable execution.

## 3. Managed batch execution

- [x] 3.1 Implement ephemeral batch admission, immutable copied inputs, workspace accounting and release; verify EX-10/14/34 and memory-bound tests cover answer growth and do not silently evict live handles.
- [x] 3.2 Implement the shared fair scheduler, serialized per-batch execution lease, atomic run/session reservation checks, and invocation/attempt deadlines; verify EX-09/21/23 under parallel generic, library, and semantic test consumers.
- [x] 3.3 Implement native classifier invocation with pinned identity, structured response-status observation, disabled native retries where supported, and abort propagation; verify fake and host adapter tests cover typed choice/bool/score results and error/aborted statuses without network use.
- [x] 3.4 Implement validated typed outcomes, explicit abstention, conservative failures and same-model lifetime-bounded retries; verify EX-11/16/17/18/19/20 for malformed answers, unknown/auth errors, transient status, cancellation, and charged retries.
- [x] 3.5 Implement pending-only continuation, explicit failed-item retry selection, immutable expectedIdentity, and correct complete-with-failures semantics; verify EX-12/13/14/19 including rejected continuation with no mutation.
- [x] 3.6 Implement generation-scoped eligible reuse and reference-safe bounded answer storage; verify EX-15 exact identity hits/misses, no failure/in-flight reuse, no allowance on hits, and authorization/persistence checks before reuse.
- [x] 3.7 Implement bounded structured pages, opaque revision cursors, diagnostics, usage grouping, and invocation-only usageDelta; verify EX-31/32/33 including whole-envelope byte caps, busy retrieval, stale cursors, unknown pricing, and free retrieval.

## 4. Pi owner and entry points

- [x] 4.1 Implement synchronous discovery/owner installation, conflict latching, protocol checking and connect facade; verify EX-06/07 using two physical compiled library copies and the installed Pi bus wrappers, with one registration and no import-time resources.
- [x] 4.2 Bind session start/shutdown, before/after navigation, reload, replacement and compaction lifecycle behavior; verify EX-20/24/25/26/37 against stale facades, disabled replacement runtimes, expired handles and preserved cumulative ledger.
- [x] 4.3 Implement decisions status/enable/disable/model/default/replenish/release commands and explicit noninteractive flags; verify EX-02/03/04/27/38 including initial-only startup opt-in, early enable, atomic defaults, confirmations, and rejected limit increases.
- [x] 4.4 Register decision_submit/results/continue with matching outputSchema/structuredContent, codemode exposure and trusted consumer kinds; verify EX-01/08/31 with direct/programmatic calls, disabled-family enforcement, and nested usage aggregation.
- [x] 4.5 Add a minimal semantic-parent test adapter using the same core without search algorithms; verify EX-08/09/36 for shared limits, pinned follow-ups, cancellation and parent completeness independent of batch completeness.

## 5. Handoff and verification

- [x] 5.1 Add privacy/adversarial fixtures and assert sanitized diagnostics/ledger exclude raw inputs, questions, answers and provider exception text; verify EX-35 while preserving structured typed outputs and documenting ordinary Pi transcript exposure.
- [x] 5.2 Add a separately opted-in native smoke command with exact model, finite budget, persisted test session and disclosed synthetic input; verify refusal without authorization/credentials and record live execution as not run unless separately authorized, never as a passed test.
- [x] 5.3 Add local usage/configuration/library documentation and a clause-level EX-01–EX-38 test/procedure map; verify examples against exported schemas/types and mark semantic capabilities and performance evaluation as not yet delivered.
- [x] 5.4 Run clean build/typecheck, the complete deterministic suite, and real Pi loader/session integrations; verify every EX clause against assertions, including duplicate copies, cancellation overrun, concurrency, expiry, storage faults and unknown usage, recording exact results.
- [x] 5.5 Pack and install the artifact in an isolated local consumer, verify library imports/declarations and Pi extension registration, and inspect package contents for missing files/secrets/accidental host bundles; record results without publishing.
- [x] 5.6 Reconcile actual behavior with proposal/design/specs/docs, run strict OpenSpec validation, and update durable goal progress with commands/results and the next phase; verify all required deterministic work is complete before requesting synchronization/archive and keep overall goal evaluation gates outstanding.
