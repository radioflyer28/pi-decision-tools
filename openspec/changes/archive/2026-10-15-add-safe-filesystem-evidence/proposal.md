# Proposal

## Why

Archived Phase C filters records but deliberately cannot discover or verify source files. Phase D supplies the deterministic, bounded filesystem foundation required by systematic search, discovery and later context expansion without granting model judgments filesystem authority.

## What Changes

- Discover Git-tracked plus non-ignored untracked working-tree paths without reading index blobs; outside Git accept only explicit confined regular files, otherwise fail git_required.
- Enforce root/path confinement, no symlink/reparse traversal, nested-repository boundaries and independent sensitive/generated/binary/size exclusions for discovered and explicit paths alike.
- Add optional additive user configuration exclusions; callers may narrow paths but cannot replace root or bypass exclusions.
- Capture stable UTF-8 source bytes and mint file evidence with exact inclusive ranges, strong hashes and runtime-root/snapshot/content identities. Produce greedy whole-line 64-line/8 KiB windows with at most eight overlapping lines and explicit oversized-line exclusions.
- Bound enumeration, admitted files, windows, retained memory and coverage details; distinguish incomplete scope/resource stops from exclusions and exhaustive processing.
- Provide internal captured-source/freshness primitives for later search and expansion, with zero classifier calls and no new public tool/library surface.
- Verify SM-16–24 through real temporary repositories/files, hostile paths and deterministic race/error fixtures; retain record/generic regressions and offline packaging checks.

## Capabilities

### New Capabilities

- `safe-filesystem-evidence`: deterministic confined discovery, exclusions, stable byte capture, bounded windows, immutable file evidence and honest scope accounting.

### Modified Capabilities

None. Existing record-only tools remain record-only, and existing core execution, memory and packaging requirements continue unchanged. The new capability specifies the additive user exclusion setting.

## Impact

Add an internal filesystem-evidence module and tests. Extend version-1 user configuration validation with optional additive exclusions, preserving default-save behavior and disabled defaults. Reuse the coordinator-owned memory pool through injection; core must not import filesystem modules. No provider SDK, runtime package dependency, semantic_search registration, public semantic library API, persistent cache, expansion or N#HH rendering is introduced. Git is an optional local executable; unavailable Git does not authorize recursive non-Git discovery. Platform verification helpers must fail closed when confinement cannot be established. No live evidence transmission or publication is authorized by this phase.
