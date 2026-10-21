# Phase D filesystem verification and security audit

This is a same-agent implementation audit, not independent review or semantic ground-truth adjudication. All source fixtures are synthetic; Git repositories are created only in isolated temporary directories. Final acceptance passed244 tests/34 files plus36 real Linux filesystem tests, typecheck/build and the offline installed-artifact audit. Phase D is synchronized and archived17/17; all six main specs validate. Actual command outcomes and archive details are recorded in [goal progress](goal-progress.md). The full contract remains [semantic acceptance](semantic-acceptance.md) and [semantic contract](semantic-contract.md).

## Requirement and SM mapping

| Delta requirement / cases | Concrete verification |
| --- | --- |
| Confined explicit scope, SM-18 | filesystem-policy tests atomic closed parsing, Unicode/byte/count limits, drive/UNC/traversal/NUL/globs, Windows devices/streams, alias/component rules. filesystem-source tests actual links/root refusal; filesystem-capture tests POSIX case-distinct files and hostile worktree config. |
| Bounded working-tree discovery, SM-16/17/20 | filesystem-capture real Git tracked edits/deletions/untracked/ignored union, global ignores, subtree narrowing, nested repositories and gitlink; non-Git directory preflight asserts zero reads. filesystem-process tests NUL data, malformed output, unavailable executable, termination/drain on bounds/timeout/abort and sanitized errors. |
| Independent exclusions/additive policy, SM-19/20 | filesystem-policy checks every named built-in table member, misleading prefixes/case and config preservation; filesystem-capture asserts excluded explicit paths never reach beforeOpen and reports first reasons. |
| Link/reparse refusal, SM-18 | filesystem-source creates actual Windows junctions/POSIX links to outside markers, checks unavailable/timed-out metadata verification; Linux capture explicitly rejects a real FIFO before open. |
| Stable capture/freshness, SM-21/24 | filesystem-source replaces/changes files at deterministic pre-open/post-read hooks and verifies cleanup; capture tests exact bytes, changes/deletion, real POSIX permission denial and busy freshness release without historical replacement. |
| Contiguous bounded windows, SM-21/22 | filesystem-windows checks BOM/Unicode/LF/CRLF/lone CR/terminal LF, invalid UTF-8/NUL, exact8192/8193 bytes,64 lines, overlap progress, oversized gaps and independent hash calculations. |
| Immutable identity, SM-24 | filesystem-capture verifies copied evidence, exact model state, unrelated snapshot independence and changed full-file identity even when the first passage hash stays identical. |
| Scope/shared memory, SM-23 | Actual10000/10001 Git entries,256/257 files,2048 windows,110 exclusion details; partial scope and unknown remaining counts. filesystem-shared uses a real Coordinator, generic native attempt, record parent and ledger to check exact measured bytes, rollback, contention, release and unchanged charges/session entries/call count. |
| Model-independent private preparation, SM-18/34 | Hostile source text cannot add reads; source/core import graph regression and inert public imports. Existing actual Pi/QuickJS seven-tool/four-family tests remain the public integration guard. Installed-artifact audit additionally loads the internal emitted capture module and checks file capture/exclusion/freshness/release. |

The POSIX runner uses a real Linux Node runtime and unprivileged filesystem semantics, not path-string simulation. Windows executes actual junction/reparse checks. Platform-specific assertions execute on their respective platform; the union, not a claim that every OS supports both kinds of object, is the acceptance evidence. No required platform case is accepted as skipped. Final totals are in goal progress.

## Same-agent security review

### Surface and trust boundary

Scope arrays, source names/content, Git output and user exclusion configuration are untrusted data. Trusted host code supplies root, memory and test-only hooks. No HTTP surface, provider endpoint or public filesystem tool is added. Git/PowerShell are local executable dependencies; metadata/config reads are distinguished from captured source. Process arguments are arrays; PowerShell paths are JSON data consumed by a fixed literal-path script.

### Findings and remediation

- **Medium, local denial of service — released scope retained private metadata.** During audit, `src/filesystem/capture.ts` release cleared file/window arrays but retained potentially large scope/exclusion strings after releasing the allocation. Remediation: captured state now lives in a real private field, and release drops the entire state reference; accessors reject expired scopes. The shared-resource test verifies exact accounting and idempotent release with unrelated work alive.
- **Medium, local scope expansion — stripping global ignore configuration.** Isolating Git's global config could include files the user had explicitly ignored. Remediation in `src/filesystem/process.ts:16`: preserve ordinary user/global ignore context, drop inherited Git override variables, and pin actual worktree plus disabled hooks/fsmonitor through command-line settings. Real global-ignore and hostile-worktree fixtures verify both sides.
- **Low, local resource pressure — repeated full candidate serialization.** Candidate admission originally recalculated the entire list on every append. It now charges incremental encoded path growth and reconciles exact size once, retaining bounded10000-entry/8MiB parser limits. Actual boundary tests exercise this path.

- **Low, valid-input rejection — generic submit JSON cap applied to scope/config.** The final audit reproduced scope_invalid/invalid_input for256 individually valid4096-byte paths. Path-bearing configuration/scope copying now uses an8MiB bound accommodating worst-case JSON escaping, while preserving all per-path/count rules and shared retained-memory limits. The regression exercises maximum combined bounds, POSIX escaping and capturer configuration.

### Non-findings and residual limitations

- Spoofing/elevation: record provenance is never accepted by this module or promoted by existing tools; evidence IDs resolve only against the owned captured scope. Returned metadata/text cannot alter retained evidence. Root/permission wiring to public search is E, not an unimplemented D authorization shortcut.
- Tampering: `source.ts` verifies root identity, link/reparse state, descriptor identity/size/timestamps and current path around reads. Full-file hashes distinguish changes outside a passage. Checks detect ordinary mutations but do not claim a hostile-local-OS sandbox.
- Disclosure: `process.ts` sanitizes process failures and bounds stderr; `sourceReason` projects stable codes. No raw source or process exception is a routine diagnostic. Captured text is deliberately available only through explicit internal evidence access; future tool transcripts must still be disclosed.
- DoS: entry/byte/time/path/file/window/detail bounds, parser kill-and-close behavior, shared allocation rollback and busy-release checks are tested. Temporary buffers are bounded but are not advertised as an exact JS heap ceiling.
- Repudiation/accounting: capture has no classifier/ledger mutation path; a real coordinator's ledger/session entries and native call count remain unchanged through capture/freshness/release and failures.

No unresolved finding is accepted as an exception to the Phase D contract. Verification remains a deterministic engineering claim, not a general security certification.

## Remaining work outside Phase D

E must integrate capture with authorized search parents, full SemanticPage output/pagination and classifier scheduling; F adds discovery order/targets; G adds verified expansion and actual pi-multiedit N#HH compatibility. H live evaluation and I release hardening are not passed by these tests. No live provider calls, source transmission, publication, quality calibration or savings measurement is claimed.
