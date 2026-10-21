import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { join } from "node:path";
import { devNull, tmpdir } from "node:os";
import { ToolkitError } from "../core/errors.js";
import { FILE_BOUNDS } from "./policy.js";

/** Never inherit GIT_DIR/worktree/config injection, credentials, startup profiles or pager commands. */
export function childEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) if (/^(path|systemroot|windir|temp|tmp|comspec|pathext|home|userprofile|homedrive|homepath|xdg_config_home)$/i.test(key)) env[key] = value;
  return { HOME: tmpdir(), USERPROFILE: tmpdir(), ...env,
    GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" };
}
export interface GitListing { entries: string[]; complete: boolean }
/** Bounded parser owns the child until close, including when a limit or abort kills it. */
export function gitListing(root: string, signal?: AbortSignal, executable = "git", timeoutMs: number = FILE_BOUNDS.processMs, paths: readonly string[] = ["."], repositoryRoot = root): Promise<GitListing> {
  return readGitListing(executable, ["--no-optional-locks", "--literal-pathspecs", "-c", "core.fsmonitor=false",
    "-c", "core.untrackedCache=false", "-c", "core.bare=false", "-c", "core.worktree=" + repositoryRoot,
    "-c", "core.hooksPath=" + (process.platform === "win32" ? "NUL" : devNull), "-C", root,
    "ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", ...paths], signal, timeoutMs);
}
/** Internal process seam permits deterministic hostile-output tests without a shell. */
export function readGitListing(executable: string, args: string[], signal?: AbortSignal, timeoutMs: number = FILE_BOUNDS.processMs): Promise<GitListing> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { env: childEnvironment(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const entries: string[] = []; let carry = Buffer.alloc(0), bytes = 0, stderr = 0, limited = false, failure: string | undefined;
    const stop = (code?: string) => { if (code) failure ??= code; else limited = true; child.kill(); };
    const abort = () => stop("cancelled");
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(() => stop("source_unverifiable"), timeoutMs);
    child.on("error", () => { failure = "git_required"; });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.length; if (stderr > 4096) stop("source_unverifiable"); });
    child.stdout.on("data", (chunk: Buffer) => {
      if (limited || failure) return;
      bytes += chunk.length;
      if (bytes > FILE_BOUNDS.discoveryBytes) { stop(); return; }
      const buffer = Buffer.concat([carry, chunk]); let offset = 0;
      while (offset < buffer.length) {
        const end = buffer.indexOf(0, offset);
        if (end < 0) break;
        if (end - offset > 4096 || entries.length >= FILE_BOUNDS.entries) { stop(); return; }
        try { entries.push(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buffer.subarray(offset, end))); }
        catch { stop("source_unverifiable"); return; }
        offset = end + 1;
      }
      carry = Buffer.from(buffer.subarray(offset));
      if (carry.length > 4096) stop();
    });
    child.on("close", code => {
      clearTimeout(timer); signal?.removeEventListener("abort", abort);
      if (failure) reject(new ToolkitError(failure));
      else if (limited) resolve({ entries, complete: false });
      else if (code !== 0 || carry.length) reject(new ToolkitError("source_unverifiable"));
      else resolve({ entries, complete: true });
    });
  });
}

const attributeScript = `[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
while ($null -ne ($line = [Console]::In.ReadLine())) {
  $answer = 'safe'
  try {
    $paths = ConvertFrom-Json -InputObject $line -ErrorAction Stop
    foreach ($path in $paths) {
      $item = Get-Item -LiteralPath $path -Force -ErrorAction Stop
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { $answer = 'link'; break }
    }
  } catch { $answer = 'unverifiable' }
  [Console]::Out.WriteLine($answer)
}`;
/** One bounded literal-path metadata worker per capture, not one PowerShell startup per file. */
export class WindowsAttributes {
  #child: ChildProcessWithoutNullStreams;
  #closed: Promise<void>;
  #dead = false;
  #pending: ((answer: string) => void) | undefined;
  #tail: Promise<unknown> = Promise.resolve();
  #output = "";
  constructor(private readonly timeoutMs: number = FILE_BOUNDS.processMs) {
    const executable = join(process.env.SystemRoot ?? process.env.SYSTEMROOT ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    this.#child = spawn(executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", attributeScript],
      { env: childEnvironment(), windowsHide: true, stdio: "pipe" });
    this.#closed = new Promise(resolve => this.#child.once("close", () => { this.#fail(); resolve(); }));
    this.#child.on("error", () => this.#fail());
    this.#child.stdin.on("error", () => this.#fail());
    this.#child.stderr.on("data", () => this.#fail());
    this.#child.stdout.setEncoding("utf8");
    this.#child.stdout.on("data", (chunk: string) => {
      this.#output += chunk;
      if (this.#output.length > 64) { this.#fail(); return; }
      const end = this.#output.indexOf("\n");
      if (end >= 0) {
        const answer = this.#output.slice(0, end).trim(); this.#output = this.#output.slice(end + 1);
        const pending = this.#pending; this.#pending = undefined;
        if (!pending || !["safe", "link", "unverifiable"].includes(answer)) this.#fail();
        else pending(answer);
      }
    });
  }
  #fail(): void { this.#dead = true; this.#child.kill(); const pending = this.#pending; this.#pending = undefined; pending?.("unverifiable"); }
  query(paths: string[]): Promise<void> {
    const run = this.#tail.then(async () => {
      const input = JSON.stringify(paths);
      if (this.#dead || Buffer.byteLength(input) > FILE_BOUNDS.fileBytes) throw new ToolkitError("unverifiable");
      const answer = await new Promise<string>(resolve => {
        const timer = setTimeout(() => this.#fail(), this.timeoutMs);
        this.#pending = value => { clearTimeout(timer); resolve(value); };
        this.#child.stdin.write(input + "\n");
      });
      if (answer !== "safe") throw new ToolkitError(answer);
    });
    this.#tail = run.catch(() => {}); return run;
  }
  async close(): Promise<void> { await this.#tail; this.#child.stdin.end(); const timer = setTimeout(() => this.#fail(), 250); await this.#closed; clearTimeout(timer); }
}
