import { randomUUID } from "node:crypto";
import type { RetainedMemory, MemoryToken } from "../core/memory.js";
import { ToolkitError, requireThat } from "../core/errors.js";
import { copyJson, identity, jsonBytes } from "../core/validation.js";
import { relativePath, relativePaths, pathKey, withinPath, PATH_JSON_BYTES } from "../core/relative-path.js";
import { FILE_BOUNDS, parseScope, exclusionFor, ordinalPaths, type ExclusionReason, type Scope } from "./policy.js";
import { prepareWindows, passageText, hashBytes, type WindowRange } from "./windows.js";
import { SafeSource, sourceReason, type CapturedFile, type SourceHooks, type InspectedFile } from "./source.js";
import { gitListing } from "./process.js";

export interface FileEvidence {
  evidenceId: string; preparationVersion: "windows-v1"; textHash: string; inputVersion: string;
  kind: "file"; verification: "captured"; rootId: string; snapshotId: string;
  path: string; startLine: number; endLine: number; fileHash: string;
}
interface StoredWindow { file: number; range: WindowRange; evidence: FileEvidence }
interface Exclusion { path: string; startLine: number | null; endLine: number | null; reason: ExclusionReason }
export interface CaptureSummary {
  rootId: string; snapshotId: string; scopeComplete: boolean;
  stopReason: "complete" | "scope_limit" | "workspace_full" | "cancelled";
  enumeration: { complete: boolean; candidatesSeen: number; remainingCandidates: number | null };
  files: { captured: number; excluded: number }; windows: number; excludedRanges: number;
  exclusions: Exclusion[]; exclusionCounts: { reason: ExclusionReason; count: number }[]; exclusionsTruncated: boolean;
}
interface CaptureState { summary: CaptureSummary; files: CapturedFile[]; windows: StoredWindow[]; scope: Scope; userExclusions: string[]; candidates: string[] }
const measure = (state: CaptureState) => state.files.reduce((sum, file) => sum + file.bytes.length, 0) + jsonBytes({
  ...state, files: state.files.map(({ path, fileHash }) => ({ path, fileHash })),
}, Number.MAX_SAFE_INTEGER);

export class CapturedScope {
  #released = false;
  #busy = 0;
  #state: CaptureState | undefined;
  constructor(private readonly root: string, private readonly memory: RetainedMemory, private readonly token: MemoryToken,
    state: CaptureState, private readonly hooks: SourceHooks) { this.#state = state; }
  get #data(): CaptureState { this.#live(); return this.#state!; }
  #live(): void { requireThat(!this.#released, "search_expired"); }
  summary(): CaptureSummary { this.#live(); return structuredClone(this.#data.summary); }
  evidence(): FileEvidence[] { this.#live(); return this.#data.windows.map(window => structuredClone(window.evidence)); }
  #window(id: string): StoredWindow { this.#live(); const window = this.#data.windows.find(w => w.evidence.evidenceId === id); requireThat(window, "invalid_input"); return window; }
  text(id: string): string { const w = this.#window(id); return passageText(this.#data.files[w.file]!.bytes, w.range); }
  snippet(id: string, offset = 0, maxLines = 20, maxBytes = 2048) {
    const w = this.#window(id), bytes = this.#data.files[w.file]!.bytes;
    const nextLine = (start: number) => { const lf = bytes.indexOf(10, start); return lf < 0 ? w.range.endByte : Math.min(lf + 1, w.range.endByte); };
    let start = w.range.startByte, skipped = 0;
    while (start < w.range.endByte && skipped < offset) { start = nextLine(start); skipped++; }
    let end = start, lines = 0;
    while (end < w.range.endByte && lines < maxLines) {
      const next = nextLine(end); if (next - start > maxBytes) break; end = next; lines++;
    }
    const span = bytes.subarray(start, end), truncated = end < w.range.endByte;
    return { evidenceId: id, path: w.evidence.path, startLine: lines ? w.range.startLine + skipped : null,
      endLine: lines ? w.range.startLine + skipped + lines - 1 : null,
      text: start === 0 ? span.toString("utf8").replace(/^\uFEFF/, "") : span.toString("utf8"), textHash: hashBytes(span),
      format: "plain" as const, truncated, nextOffsetLines: truncated ? skipped + lines : null, freshness: "captured" as const };
  }
  item(id: string, predicate: string): { id: string; inputVersion: string; state: unknown } {
    const w = this.#window(id); copyJson(predicate); requireThat(typeof predicate === "string" && predicate.length > 0 && Buffer.byteLength(predicate) <= 2048);
    return { id, inputVersion: w.evidence.inputVersion, state: { predicate,
      evidence: { text: this.text(id), source: { kind: "file", path: w.evidence.path, startLine: w.evidence.startLine, endLine: w.evidence.endLine } } } };
  }
  async freshness(id: string, signal?: AbortSignal): Promise<"unchanged" | "changed" | "missing" | "unverifiable"> {
    const w = this.#window(id), original = this.#data.files[w.file]!;
    const source = new SafeSource(this.root, this.hooks); this.#busy++;
    try {
      requireThat(!signal?.aborted, "cancelled");
      if (exclusionFor(original.path, this.#data.userExclusions)) return "unverifiable";
      const inspected = await source.inspect(original.path);
      requireThat(!signal?.aborted, "cancelled");
      if (await source.nested(inspected.path)) return "unverifiable";
      const current = await source.capture(inspected, signal);
      requireThat(!signal?.aborted, "cancelled");
      return current.fileHash === original.fileHash ? "unchanged" : "changed";
    } catch (error) {
      if (signal?.aborted) throw new ToolkitError("cancelled");
      const reason = sourceReason(error); return reason === "missing" ? "missing" : reason === "changed" ? "changed" : "unverifiable";
    } finally { await source.close(); this.#busy--; }
  }
  release(): void {
    if (this.#released) return;
    requireThat(this.#busy === 0, "search_busy"); this.#released = true;
    this.#state = undefined; this.memory.release(this.token);
  }
}

export class FileEvidenceCapturer {
  readonly rootId = randomUUID();
  #exclusions: string[];
  constructor(private readonly root: string, private readonly memory: RetainedMemory,
    userExclusions: unknown = [], private readonly hooks: SourceHooks = {}) {
    this.#exclusions = relativePaths(copyJson(userExclusions, PATH_JSON_BYTES), true);
  }
  async capture(value: unknown = {}, signal?: AbortSignal): Promise<CapturedScope> {
    const scope = parseScope(value), source = new SafeSource(this.root, this.hooks);
    const summary: CaptureSummary = { rootId: this.rootId, snapshotId: "0".repeat(64), scopeComplete: false, stopReason: "complete",
      enumeration: { complete: false, candidatesSeen: 0, remainingCandidates: null }, files: { captured: 0, excluded: 0 },
      windows: 0, excludedRanges: 0, exclusions: [], exclusionCounts: [], exclusionsTruncated: false };
    const state: CaptureState = { summary, files: [], windows: [], scope, userExclusions: [...this.#exclusions], candidates: [] };
    const token = this.memory.allocate(measure(state), 4096);
    const account = (reserved = 4096) => this.memory.resize(token, measure(state), reserved);
    const stop = (reason: CaptureSummary["stopReason"]) => { summary.stopReason = reason; summary.scopeComplete = false; };
    const exclude = (path: string, reason: ExclusionReason, startLine: number | null = null, endLine: number | null = null) => {
      if (startLine === null) summary.files.excluded++; else summary.excludedRanges++;
      const count = summary.exclusionCounts.find(item => item.reason === reason);
      if (count) count.count++; else summary.exclusionCounts.push({ reason, count: 1 });
      if (summary.exclusions.length < FILE_BOUNDS.exclusions) {
        summary.exclusions.push({ path, reason, startLine, endLine });
        try { account(); } catch { summary.exclusions.pop(); summary.exclusionsTruncated = true; }
      } else summary.exclusionsTruncated = true;
    };
    try {
      await source.verifyRoot();
      const repositoryRoot = await source.gitRoot(), git = repositoryRoot !== null;
      // Preflight every explicitly scoped directory before any non-Git source read.
      if (!git) {
        if (!scope.paths) throw new ToolkitError("git_required");
        for (const path of scope.paths) {
          try { if ((await source.inspect(path)).stat.isDirectory()) throw new ToolkitError("git_required"); }
          catch (error) { if (error instanceof ToolkitError && error.code === "git_required") throw error; }
        }
      }
      if (signal?.aborted) throw new ToolkitError("cancelled");
      const listing = git ? await gitListing(source.root, signal, undefined, undefined, scope.paths, repositoryRoot!) : { entries: scope.paths!, complete: true };
      summary.enumeration.complete = listing.complete; summary.enumeration.candidatesSeen = listing.entries.length;
      if (!listing.complete) stop("scope_limit");
      const seen = new Set<string>(); let candidateBytes = measure(state);
      for (const raw of listing.entries) {
        let path: string;
        try {
          const entry = git && raw.endsWith("/") ? raw.slice(0, -1) : raw;
          path = relativePath(entry); if (git && path !== entry) throw new ToolkitError("outside_root");
        }
        catch { exclude("", "outside_root"); continue; }
        if (scope.paths && !scope.paths.some(prefix => withinPath(path, prefix))) continue;
        const key = pathKey(path); if (seen.has(key)) continue; seen.add(key);
        state.candidates.push(path);
        const nextBytes = candidateBytes + Buffer.byteLength(JSON.stringify(path)) + 1;
        try { this.memory.resize(token, nextBytes, 4096); candidateBytes = nextBytes; }
        catch { state.candidates.pop(); stop("workspace_full"); break; }
      }
      seen.clear(); if (git) listing.entries.length = 0;
      ordinalPaths(state.candidates); account();
      let visited = 0; const actualPaths = new Set<string>();
      for (const candidate of state.candidates) {
        if (signal?.aborted) { stop("cancelled"); break; }
        let inspected: InspectedFile | undefined, failure: ExclusionReason | undefined;
        try { inspected = await source.inspect(candidate); }
        catch (error) { failure = sourceReason(error); }
        if (failure && ["outside_root", "link", "nonregular"].includes(failure)) { exclude(candidate, failure); visited++; continue; }
        if (inspected) {
          const actualKey = pathKey(inspected.path);
          if (actualPaths.has(actualKey)) { visited++; continue; }
          actualPaths.add(actualKey);
          if (await source.nested(inspected.path)) { exclude(inspected.path, "nested_repository"); visited++; continue; }
          if (!inspected.stat.isFile()) { exclude(inspected.path, "nonregular"); visited++; continue; }
        }
        const path = inspected?.path ?? candidate, policyReason = exclusionFor(path, this.#exclusions);
        if (policyReason) { exclude(path, policyReason); visited++; continue; }
        if (failure || !inspected) { exclude(path, failure ?? "unverifiable"); visited++; continue; }
        if (inspected.stat.size > BigInt(FILE_BOUNDS.fileBytes)) { exclude(path, "file_too_large"); visited++; continue; }
        if (state.files.length >= FILE_BOUNDS.files) { stop("scope_limit"); break; }
        try { account(Number(inspected.stat.size) + 4097); }
        catch { stop("workspace_full"); break; }
        let file: CapturedFile;
        try { file = await source.capture(inspected, signal); }
        catch (error) {
          account();
          if (error instanceof ToolkitError && error.code === "cancelled") { stop("cancelled"); break; }
          exclude(path, sourceReason(error)); visited++; continue;
        }
        if (!file.bytes.length) { account(); exclude(path, "empty"); visited++; continue; }
        let prepared: ReturnType<typeof prepareWindows>;
        try { prepared = prepareWindows(file.bytes, FILE_BOUNDS.windows - state.windows.length); }
        catch { account(); exclude(path, "binary_or_encoding"); visited++; continue; }
        const fileIndex = state.files.length, oldWindows = state.windows.length;
        state.files.push(file);
        for (const range of prepared.windows) {
          const inputVersion = identity({ rootId: this.rootId, path: file.path, startLine: range.startLine, endLine: range.endLine,
            fileHash: file.fileHash, textHash: range.textHash, preparationVersion: "windows-v1" });
          state.windows.push({ file: fileIndex, range, evidence: { evidenceId: randomUUID(), preparationVersion: "windows-v1",
            kind: "file", verification: "captured", rootId: this.rootId, snapshotId: summary.snapshotId, path: file.path,
            startLine: range.startLine, endLine: range.endLine, fileHash: file.fileHash, textHash: range.textHash, inputVersion } });
        }
        try { account(); }
        catch { state.files.pop(); state.windows.length = oldWindows; account(); stop("workspace_full"); break; }
        summary.files.captured++; summary.windows = state.windows.length;
        for (const range of prepared.excluded) exclude(file.path, range.reason, range.startLine, range.endLine);
        visited++;
        if (!prepared.complete) { stop("scope_limit"); break; }
      }
      summary.scopeComplete = summary.stopReason === "complete" && summary.enumeration.complete && visited === state.candidates.length;
      summary.enumeration.remainingCandidates = summary.scopeComplete ? 0 : null;
      summary.snapshotId = identity({ rootId: this.rootId, scope, exclusions: this.#exclusions,
        files: state.files.map(file => ({ path: file.path, fileHash: file.fileHash })) });
      for (const window of state.windows) window.evidence.snapshotId = summary.snapshotId;
      account(0);
      return new CapturedScope(source.root, this.memory, token, state, this.hooks);
    } catch (error) {
      this.memory.release(token);
      if (error instanceof ToolkitError) throw error;
      throw new ToolkitError("source_" + sourceReason(error));
    } finally { await source.close(); }
  }
}
