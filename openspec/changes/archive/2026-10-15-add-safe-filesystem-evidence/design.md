# Design

## Context

See proposal.md. A–C are archived; there are five main specs, seven tools and 207 passing tests. The working project has no Git repository; git 2.56.0.windows.2 is available for isolated fixtures. Existing semantic preparation/views deliberately read no source files. Coordinator exposes one RetainedMemory pool; Configuration is a closed version-1 object and UserConfiguration.saveDefault preserves validated fields. Public imports expose only connect/protocolVersion and must remain inert.

The handoff is goal.md Phase D and semantic-contract sections 3–7 plus SM-16–24. Actual POSIX verification is possible through WSL Ubuntu (Git available), but node is not currently on its default PATH; locating an already installed Linux runtime or arranging a bounded local runtime is specific verification setup, not permission to replace POSIX evidence with Windows-only assumptions.

## Goals / Non-Goals

**Goals:** A usable internal deterministic capture component, tested with real temporary repositories and files, plus pure policy/windows/identity functions and explicit shared-memory ownership. It must supply the frozen initial file inventory needed by E and the full captured bytes/freshness foundation needed by G.

**Non-Goals:** No search tool, semantic classification, discovery stopping/prioritization, expansion, hashline rendering, public semantic facade, persistent cache or runtime auto-capture. E will connect capture to the elected owner and search parent; D exposes no model-controlled filesystem entry point. No live provider invocation or measured quality claim.

## Decisions

### Module and resource seam

Create internal src/filesystem modules for scope/policy, byte windows, platform-safe I/O/discovery and captured scope ownership. The constructor receives a trusted root, immutable user exclusions and the existing RetainedMemory instance; never allocate a second pool internally. A capture owns a releasable allocation and immutable snapshot; consuming E parents will own/release that capture. No global cache. Root identity is stable per capturer runtime and opaque; independent runtime reconstruction changes it. Public returned copies cannot mutate private buffers or metadata. Hold full captured bytes once, window byte offsets/ranges and metadata rather than duplicating all overlapping text; materialize model text on demand. Count every actual retained serialized copy and reserve before admitting growth, releasing failed captures/temporary growth cleanly. Shared 8 MiB remains a serialized-data bound, not an exact JS heap promise.

Alternative: put filesystem methods on Coordinator or record SemanticResults. Rejected: that would couple generic imports to filesystem acquisition and risk granting record provenance authority. No D change to parent count/child count/ledger behavior is needed.

### Scope and policy

Expose closed capture scope `{paths?:string[]}` only. F will add prioritized order separately; D stays ordinal path bytes then line number. Copy/validate before any source capture. Normalize harmless dot and separator forms, refuse parent traversal, absolute/drive/UNC/NUL/glob/invalid Unicode and Windows alternate streams/device-name aliases. Preserve actual on-disk case; deduplicate platform aliases without lowercasing POSIX distinct names. Git-returned raw paths are not user syntax: an unrepresentable filename is excluded rather than rewritten into another file's path. Bounds and invalid-path diagnostics never echo arbitrary input text.

Add optional Configuration.fileExclusions (0–256 unique safe relative paths, <=4096 UTF-8 bytes each); omission/empty means no added exclusions. Pure validation belongs in consumer-neutral code so core does not import filesystem modules. This is a user-owned additive setting; capture scope cannot override it. Existing saveDefault round-trips it atomically. Exact file or directory-prefix matches use component boundaries and platform path semantics. Add stable reason user_excluded to the contract; this is an explicit additive clarification, not a relaxation of built-in rules.

Apply the contract's exact ASCII-insensitive sensitive/generated tables. Precedence: invalid/outside/link/nonregular, nested repository, sensitive, dependency_generated, user_excluded, missing/unreadable/changed/unverifiable capture, size, binary_or_encoding, empty, line_too_large ranges. Check safety structurally before opening; path exclusions happen before content reads. User exclusions never remove built-in categories. Do not treat `secrets-old` as segment `secrets`, while `.env.example` is intentionally sensitive.

### Git discovery without shell interpretation

Use bounded subprocess execution of Git with argument arrays and NUL output, no shell or caller options, disabled optional locks/prompts and sanitized process diagnostics. Discover the actual work-tree root and constrain to the host project subtree when cwd is inside a larger repository. Refuse a linked/unsafe root and independently validate every path. Enumerate tracked and nonignored untracked working-tree paths; do not recurse submodules or use index blobs for content. Detect nested `.git` directory/file markers (including explicit paths into nested repositories) without reading marker contents. Git failures are not proof of a non-Git directory: only a verified absence of repository context permits explicit-file fallback. Missing Git can still support verified explicit non-Git files, never traversal.

Bound emitted entries, bytes, individual path lengths, child lifetime and stderr. Stop/terminate a child once a bound is reached, drain it and retain only bounded metadata; truncation yields incomplete scope rather than successful empty discovery. Ordinal-sort the retained candidate set before capture and deduplicate using platform identity. Use temporary Git repositories in tests, not git init in this project. External Git environment/config must not widen the worktree or execute a pager/helper; tests include adversarial inherited Git settings.

Alternative: recursively walk the whole tree and run check-ignore per file. Rejected: it visits excluded directories and cannot guarantee the correct tracked/ignored union cheaply. An unbounded execFile output buffer is also rejected.

### Confinement and stable capture

Verify root ancestry and candidate components with lstat, realpath containment and regular-file checks; refuse intermediate/final links. On Windows additionally inspect FileAttributes.ReparsePoint using a bounded trusted system PowerShell metadata helper (NoProfile/NonInteractive, literal paths supplied as data, no interpolated script or provider environment). This covers reparse tags Node's isSymbolicLink may not expose. If the helper is unavailable or ambiguous, report unverifiable instead of silently weakening the checks. Batch component attribute checks to avoid one process per ancestor; no content is read by the helper. On POSIX use no-follow open flags where available and nonblocking opens to avoid a substituted device/FIFO hanging capture.

Open the verified regular file, compare descriptor identity/size/timestamps to pre-open metadata, read at most the cap plus a sentinel byte, then recheck descriptor/path/component identity. Observed mutation yields changed; permission/verification failures remain explicit. Release handles in finally. Bound work and honor cancellation between bounded operations; no detached I/O remains after settlement. This detects ordinary replacement races, not a hostile-local-filesystem sandbox: the contract expressly disclaims a stronger OS guarantee.

Freshness takes an internally owned captured-file identity, never caller provenance. It repeats safe bounded capture and compares full-file hash; returns unchanged/changed/missing/unverifiable without replacing historical content. G will use the same primitive before widening or dispatch; D does not perform that widening.

### Byte windows and identity

Fatal UTF-8 decoding rejects malformed bytes and NUL. Retain original Buffer, BOM and terminators for hashes. Index lines by LF; CR before LF remains in the terminator, lone CR is content; terminal LF does not create an extra line. Empty file is excluded. Greedy contiguous windows stop at 64 lines/8192 bytes; overlap `min(8, previousWindowLines-1)` whole lines and advance. Over-8192-byte lines each produce one exclusion and reset overlap so regions cannot join. Test byte rather than JS character boundaries and exact 8192/8193 cases.

Use existing sorted-key canonical hashing. File evidence contains rootId, snapshotId, normalized path, startLine/endLine, fileHash, textHash, preparationVersion windows-v1, inputVersion and opaque evidenceId. Snapshot hashes ordered admitted path/fileHash inventory plus scope/user-policy identity; it is not an atomic repository snapshot. Input version excludes snapshotId and opaque IDs but includes stable runtime root, own path/range/full-file/passage hashes/preparation. Exact classifier materialization follows `{predicate,evidence:{text,source:{kind:'file',path,startLine,endLine}}}`; strip leading BOM only for a span starting at byte zero. No model is invoked.

### Coverage and bounds

Represent discovery completeness separately from capture completeness. Record candidatesSeen, remainingCandidates (null when unknown), captured/excluded file counts, excluded ranges, capped detail list and uncapped bounded observed reason counts. Directory scope filters discovery; excluded files count once by first applicable reason; oversized line ranges do not turn the containing nonempty file into several excluded files. Cap entries at10000, admitted files256, initial windows2048 and details100; crossing any hard scope cap reports scope_limit and requires a narrower new capture, not an implicitly resumable rescan. Shared memory pressure reports workspace_full, never a content exclusion or complete scope. The saved snapshot explicitly includes partial status; E will project it into SemanticPage without equating capture completion to judgment completion. Count temporary candidate metadata/reserved growth conservatively; bounded subprocess buffers/transient per-file read buffers are disclosed separately from retained memory.

### Verification

Add pure path/policy/window/identity tests; real temporary Git/non-Git integration; link/junction/device/race/permission fixtures; bounded injected I/O at exact caps; shared memory conservation under existing generic/record allocations. Actual real-filesystem tests must exercise Windows junction/reparse checks and POSIX symlink/FIFO/case-distinct behavior with a Linux Node runtime, recording platform evidence separately. Deterministic hooks simulate the otherwise nondeterministic mutation points without substituting fake trees for all integration tests. Zero model capability is wired into capture. Re-run existing actual Pi/QuickJS family/cross-copy tests and offline installed-package verification to prove unchanged public tools and inert imports. Add an installed internal capture smoke to ensure emitted files work without source imports.

Perform a same-agent security/requirement audit and map SM-16–24 to concrete tests, distinguishing D capture primitives from future E parent projection and G tool/expansion behavior. Update docs/configuration examples and durable progress. No skipped required platform/safety case may be called passed.

## Risks / Trade-offs

- Windows metadata helper overhead → bounded batched ancestry checks, fixed timeout/output limits, explicit unverifiable on failure; no unsafe fallback.
- Concurrent mutation cannot be fully sandboxed in portable Node → pre/open/post identity and confinement checks, failure-injection tests, explicit threat-model limitation.
- Git can emit huge/pathological output → streaming bounded NUL parser, entry/byte/time caps and actual process termination/drain tests.
- Full captured bytes compete with parents/generic work → injected single pool, atomic admission, explicit partial workspace_full, no secret eviction or persistent spill.
- Platform test setup may lack Linux Node → locate an existing runtime or arrange a bounded official local runtime; verify actual POSIX behavior before completion rather than silently skipping it.

## Migration Plan

Implement deterministic internals and additive config support, then tests/docs/installed verification. Existing configs remain valid and default-disabled; seven tools/public exports are unchanged. Rollback removes the optional config field before using an older strict parser. Apply verification is followed by separate inline spec synchronization and archive under the active Phase D authorization. No publication or live evaluation is part of rollout.

## Implementation reconciliation

Final implementation preserves standard user/global Git ignores (discarding them would widen discovery), drops inherited Git override variables and pins worktree with disabled hooks/fsmonitor. POSIX checks canonical root identity and no-follow candidate components; Windows additionally checks every root ancestor for reparse attributes with one bounded worker. Capture state is truly private and release drops its entire reference. Path-bearing JSON accepts the full256x4096-byte contract including escaping without reusing the smaller generic-submit cap. The retained8MiB resource limit remains independent of input syntax admission.

Actual verification and same-agent security mapping: docs/filesystem-verification.md and docs/goal-progress.md. Full suite244 tests/34 files, real Linux36 filesystem tests, typecheck/build and offline installed-artifact audit passed after final code edits. This is deterministic Phase-D evidence, not semantic quality or later search/expansion implementation.
