# Tasks

## 1. Pure scope, exclusion and byte contracts

- [x] 1.1 Implement closed copied scope/path normalization and platform-aware alias rules; verify atomic rejection, traversal/drive/UNC/glob/NUL/Unicode/device/alternate-stream inputs, component boundaries and valid relative paths.
- [x] 1.2 Implement the exact built-in sensitive/generated exclusion tables and additive fileExclusions configuration validation; verify misleading case/prefixes, invalid settings, backward-compatible defaults and atomic default-save preservation without authorization.
- [x] 1.3 Implement fatal UTF-8 line indexing and greedy bounded windows; verify exact hashes/ranges for empty/BOM/LF/CRLF/lone-CR/Unicode/NUL/invalid encoding, 64-line/8192-byte limits, overlap progress and explicit oversized-line gaps.

## 2. Verified source capture

- [x] 2.1 Implement component/root confinement with no-follow regular-file checks and bounded Windows reparse verification; verify actual junction/link rejection, helper failure/timeout fail-closed behavior and zero outside marker content reads.
- [x] 2.2 Implement bounded descriptor capture with pre/open/post identity checks and sanitized failures; verify race injection, replacement/size change, permission/nonregular/device handling, cancellation and handle cleanup.
- [x] 2.3 Implement current-source freshness against owned captured identity; verify unchanged/changed/missing/unverifiable outcomes and that historical bytes/hashes never mutate or authorize record provenance reads.

## 3. Deterministic discovery and scope coverage

- [x] 3.1 Implement bounded NUL-safe Git working-tree discovery with sanitized argument/environment handling and termination/drain; verify tracked modifications, untracked/ignored/deleted paths, strange filenames, project subtrees, output/entry/time bounds and hostile inherited Git settings.
- [x] 3.2 Implement non-Git explicit-file behavior, shared exclusions and nested repository/submodule refusal; verify omitted/directory git_required before source reads, explicit safe files, unavailable/failed Git distinction and no bypass through explicit paths.
- [x] 3.3 Implement scope coverage and bounded exclusions; verify actual 10000-entry/256-file/2048-window boundaries, detail cap100 with full observed totals, first-reason file counting, separate excluded ranges and incomplete/unknown remaining scope on limits.

## 4. Captured evidence ownership

- [x] 4.1 Implement immutable file/root/snapshot/passage identities and exact classifier-state materialization without invoking a model; verify full-file changes, unrelated inventory independence, original source ranges, BOM handling and mutation isolation.
- [x] 4.2 Integrate captured scopes with the injected coordinator RetainedMemory pool and explicit release; verify measured retained copies/reservations, atomic admission rollback, cross-family contention, partial workspace_full, idempotent release and unchanged ledger liability.
- [x] 4.3 Verify the internal end-to-end capture workflow on real temporary Git/non-Git fixtures, including hostile source text; assert zero classifier calls, deterministic ordering/coverage, no persistence, no new tool and no core filesystem import.

## 5. Platform, security, documentation and packaging verification

- [x] 5.1 Run real Windows junction/reparse and POSIX symlink/FIFO/case-distinct fixtures with platform-appropriate runtimes; record observed platform evidence and resolve required failures rather than silently skipping them.
- [x] 5.2 Perform a requirement-by-requirement same-agent security audit and map SM-16–24 to concrete assertions, separating implemented D primitives from later E/G integration; verify no raw-source/process-error leakage or scope/exclusion bypass.
- [x] 5.3 Update configuration, usage, limitations, semantic handoff and durable phase progress documentation; verify local links/examples and distinguish internal capture from unavailable search/expansion and unmeasured quality.
- [x] 5.4 Extend offline installed-artifact verification with internal capture while retaining inert public imports/types, unbundled peers and seven-tool/four-family behavior; run typecheck, full isolated tests and offline package checks and record actual output without live calls/publication.
- [x] 5.5 Reconcile implementation and all verification against the Phase D roadmap, nine delta requirements and Phase B handoff; run strict OpenSpec validation and verify every task before separate synchronization/archive.
