import { lstat, realpath, open } from "node:fs/promises";
import { constants, type BigIntStats } from "node:fs";
import { resolve, parse, join, relative, sep, dirname } from "node:path";
import { ToolkitError } from "../core/errors.js";
import { relativePath, pathKey } from "../core/relative-path.js";
import { FILE_BOUNDS, type ExclusionReason } from "./policy.js";
import { hashBytes } from "./windows.js";
import { WindowsAttributes } from "./process.js";

export interface SourceHooks {
  beforeOpen?: (path: string) => Promise<void>;
  afterRead?: (path: string) => Promise<void>;
  attributes?: (paths: string[]) => Promise<void>;
}
export interface InspectedFile { path: string; absolute: string; stat: BigIntStats }
export interface CapturedFile { path: string; bytes: Buffer; fileHash: string }
export function sourceReason(error: unknown): ExclusionReason {
  if (error instanceof ToolkitError && ["outside_root", "link", "nonregular", "nested_repository", "missing", "unreadable", "changed", "unverifiable", "file_too_large"].includes(error.code)) return error.code as ExclusionReason;
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return code === "ENOENT" || code === "ENOTDIR" ? "missing" : code === "EACCES" || code === "EPERM" ? "unreadable" : "unverifiable";
}
const same = (a: BigIntStats, b: BigIntStats) => a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
const aborted = (signal?: AbortSignal) => { if (signal?.aborted) throw new ToolkitError("cancelled"); };

/** Trusted internal I/O seam. Not a public library API or record-provenance resolver. */
export class SafeSource {
  readonly root: string;
  #attributes: WindowsAttributes | undefined;
  #closed = false;
  constructor(root: string, private readonly hooks: SourceHooks = {}) { this.root = resolve(root); }
  async #chain(absolute: string): Promise<BigIntStats> {
    if (this.#closed) throw new ToolkitError("search_expired");
    const base = this.root, rel = relative(base, absolute);
    if (rel === ".." || rel.startsWith(".." + sep) || parse(rel).root) throw new ToolkitError("outside_root");
    const parts = rel.split(sep).filter(Boolean), paths = [base];
    let current = base, last = await lstat(current, { bigint: true });
    if (last.isSymbolicLink()) throw new ToolkitError("link");
    for (const part of parts) {
      if (!last.isDirectory()) throw new ToolkitError("nonregular");
      current = join(current, part); last = await lstat(current, { bigint: true }); paths.push(current);
      if (last.isSymbolicLink()) throw new ToolkitError("link");
    }
    if (this.hooks.attributes) await this.hooks.attributes(paths);
    else if (process.platform === "win32") {
      // Node checks the root and its children; the metadata worker also rejects opaque ancestor reparse tags.
      const ancestors: string[] = []; let ancestor = dirname(base);
      while (ancestor !== dirname(ancestor)) { ancestors.unshift(ancestor); ancestor = dirname(ancestor); }
      this.#attributes ??= new WindowsAttributes(); await this.#attributes.query([ancestor, ...ancestors, ...paths]);
    }
    return last;
  }
  async verifyRoot(): Promise<void> {
    const stat = await this.#chain(this.root);
    if (!stat.isDirectory()) throw new ToolkitError("nonregular");
    if (pathKey(await realpath(this.root)) !== pathKey(this.root)) throw new ToolkitError("outside_root");
  }
  async inspect(path: string): Promise<InspectedFile> {
    let normalized: string;
    try { normalized = relativePath(path); } catch { throw new ToolkitError("outside_root"); }
    if (normalized !== path) throw new ToolkitError("outside_root");
    await this.verifyRoot();
    const absolute = join(this.root, ...path.split("/")), stat = await this.#chain(absolute);
    const canonical = await realpath(absolute), rel = relative(await realpath(this.root), canonical);
    if (!rel || rel === ".." || rel.startsWith(".." + sep) || parse(rel).root) throw new ToolkitError("outside_root");
    return { absolute, path: rel.split(sep).join("/"), stat };
  }
  async nested(path: string): Promise<boolean> {
    const parts = path.split("/"); let directory = this.root;
    for (let i = 0; i < parts.length; i++) {
      directory = join(directory, parts[i]!);
      // A file's trailing /.git is ENOTDIR; a directory/gitlink is detected too.
      try { await lstat(join(directory, ".git")); return true; }
      catch (error) { if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) throw new ToolkitError("unverifiable"); }
    }
    return false;
  }
  async gitRoot(): Promise<string | null> {
    await this.verifyRoot(); let directory = this.root;
    while (true) {
      try {
        const stat = await lstat(join(directory, ".git"));
        if (stat.isSymbolicLink() || !(stat.isDirectory() || stat.isFile())) throw new ToolkitError("unverifiable");
        if (process.platform === "win32") { this.#attributes ??= new WindowsAttributes(); await this.#attributes.query([join(directory, ".git")]); }
        return directory;
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      const parent = dirname(directory); if (parent === directory) return null; directory = parent;
    }
  }
  async capture(inspected: InspectedFile, signal?: AbortSignal): Promise<CapturedFile> {
    aborted(signal);
    if (!inspected.stat.isFile()) throw new ToolkitError("nonregular");
    if (inspected.stat.size > BigInt(FILE_BOUNDS.fileBytes)) throw new ToolkitError("file_too_large");
    await this.hooks.beforeOpen?.(inspected.absolute); aborted(signal);
    const checked = await this.inspect(inspected.path);
    if (!same(checked.stat, inspected.stat)) throw new ToolkitError("changed");
    const handle = await open(checked.absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    try {
      const before = await handle.stat({ bigint: true });
      if (!before.isFile() || !same(before, inspected.stat)) throw new ToolkitError("changed");
      const buffer = Buffer.alloc(Number(before.size) + 1); let length = 0;
      while (length < buffer.length) {
        aborted(signal); const result = await handle.read(buffer, length, buffer.length - length, length);
        if (result.bytesRead === 0) break; length += result.bytesRead;
      }
      await this.hooks.afterRead?.(checked.absolute); aborted(signal);
      const after = await handle.stat({ bigint: true }), current = await this.inspect(checked.path);
      if (length !== Number(before.size) || !same(before, after) || !same(before, current.stat)) throw new ToolkitError("changed");
      const bytes = Buffer.from(buffer.subarray(0, length));
      return { path: current.path, bytes, fileHash: hashBytes(bytes) };
    } finally { await handle.close(); }
  }
  async close(): Promise<void> { this.#closed = true; await this.#attributes?.close(); }
}
