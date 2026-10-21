# Internal filesystem evidence (Phase D)

## Availability and authority

Phase D supplies the deterministic internal capture foundation. Phase E consumes it through [authorized systematic search](search-usage.md), the eighth tool. Public `connect`/`protocolVersion` exports remain unchanged. There is no automatic project scan or caller-controlled root. F adds discovery stopping and G adds expansion/hashlines. Capturing or checking source never calls a classifier or grants transmission permission. Caller record provenance remains unverified and never invokes this foundation.

The internal capturer receives a trusted project root, validated user exclusions and the existing coordinator memory pool. The returned scope owns ephemeral captured bytes, metadata and windows; it exposes copied metadata, captured passage text, exact classifier input construction, freshness and release. It is not a supported public library API or a resumable disk cache. Its `scopeComplete` means deterministic enumeration/capture completed, **not** that any semantic judgment ran.

## Scope and exclusions

Git discovery uses tracked plus non-ignored untracked working-tree paths. It reads modified working-tree bytes, not index blobs; deleted tracked files are missing exclusions. Scope paths narrow the Git candidate set. Git uses NUL-delimited paths, literal pathspecs, a bounded subprocess, disabled fsmonitor/hooks and a pinned repository worktree. Inherited Git override variables and provider credentials are dropped. Standard user/global ignore configuration is honored so ignoring that configuration cannot silently widen capture. Git configuration/ignore/index metadata are distinct from captured source; no network transport is invoked.

Outside Git, only explicit confined files are supported. Omitted scope or a directory fails git_required before content capture. Invalid scope rejects atomically: 1–256 unique paths when present, <=4096 UTF-8 bytes each, no absolute/drive/UNC/traversal/NUL/glob/invalid Unicode paths. Harmless dot/separator forms normalize; Windows device, alternate-stream and trailing-dot/space aliases are refused. Case-distinct POSIX paths are preserved. Missing Git or discovery failure never triggers recursive fallback.

All paths undergo the same built-in policy, including tracked and explicit paths. See [contract section 7](semantic-contract.md#7-deterministic-filesystem-scope) for exact sensitive/generated tables and precedence. Links, junctions/reparse points, nonregular objects and nested repositories/submodules are refused. Sensitive paths such as `.env.example` remain excluded even if explicitly named. User additions use component boundaries, so `private` does not exclude `private-old`.

Example user `decision-tools.json` (no saved enabled state):

```json
{
  "version": 1,
  "families": { "generic": true, "semantic": false },
  "fileExclusions": ["private", "notes/local.txt"],
  "limits": {
    "requests": 100, "inputBytes": 1048576, "concurrency": 2,
    "maxWorkMs": 10000, "maxAttemptMs": 5000, "maxRetries": 1
  }
}
```

fileExclusions may be omitted or contain 0–256 unique relative file/directory paths of at most4096 UTF-8 bytes each. The setting only adds exclusions (`user_excluded`); tools cannot replace the root or remove built-in policy. Default-model saving preserves it without enabling anything. For rollback to a pre-D strict parser, remove this optional field first. Current record tools do not acquire files regardless of this setting.

## Exact evidence, bounds and coverage

- Fatal UTF-8 decoding; invalid bytes/NUL excluded. Empty files produce no window. Original BOM, LF/CRLF and lone-CR bytes are retained in hashes. Display/classifier text omits a leading BOM only for a span starting at byte zero. Terminal LF adds no phantom line.
- Greedy contiguous whole-line windows: at most64 lines/8192 bytes including terminators, overlap at most8 lines and advance at least1. A line over8192 bytes is an explicit `line_too_large` range; windows never cross that gap or invent partial lines.
- File/passage SHA-256 hashes and inclusive one-based ranges are deterministic. Input identity covers runtime root, own path/range/full-file/passage hashes and preparation version. Opaque IDs and unrelated inventories are excluded. Snapshot identity covers ordered captured inventory and scope/policy, not an atomic repository-wide snapshot guarantee.
- Enumeration is capped at10000 emitted entries and8MiB subprocess output; files at256 and1MiB each; windows at2048. Hard limits yield `scope_limit`, incomplete scope and unknown remaining counts where appropriate. A narrower new capture is required; no implicit rescan/continuation is promised.
- Retained buffers, window/identity metadata, scope/candidate lists and reservations share the coordinator's existing8MiB pool. Memory pressure is `workspace_full`, not a content exclusion. Admitted evidence survives a partial stop. This is serialized retained-data accounting, not a JS heap bound; bounded transient I/O/parser buffers exist separately.
- File exclusions count each file once by first applicable reason; excluded ranges are separate. Details are capped at100 (or less if memory prevents detail growth); reason totals retain all observed exclusions and truncation is explicit. Complete scope does not mean every candidate was eligible or any predicate was satisfied.

## Capture stability, freshness and limitations

Root canonical identity and no-follow component checks precede bounded descriptor reads. File identity, size and timestamps are checked before/after read and against the current path. Windows also checks reparse attributes through one bounded trusted-system PowerShell metadata worker; inability to verify yields an explicit unverifiable result, never an unsafe fallback. Source errors use stable codes rather than underlying exception text.

Freshness accepts an owned evidence ID, repeats confinement/policy/stability checks and compares the full file hash. It returns unchanged/changed/missing/unverifiable while historical passage text stays unchanged. It does not widen context or resubmit a judgment. Release refuses while freshness is active, drops private captured state and frees only its memory allocation; it cannot refund classifier spending or invalidate unrelated handles. Released data access fails search_expired.

These checks are **not an OS sandbox against malicious concurrent filesystem mutation**. Path heuristics are not secret detection. Standard Git metadata and Windows metadata helpers run locally and must be trusted as installed executables. No source bytes are sent to a model by Phase D. Phase E search independently enforces family/session authorization, persistence, pinned models and budgets. No N#HH anchors or semantic quality/savings claims are supplied here.

For tests, platform observations and remaining phase gates see [filesystem verification](filesystem-verification.md) and [goal progress](goal-progress.md).
