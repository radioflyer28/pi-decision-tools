import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Configuration, ModelKey } from "../core/contracts.js";
import { ToolkitError } from "../core/errors.js";
import { DEFAULT_LIMITS, parseConfiguration } from "../core/validation.js";

export function defaultConfiguration(): Configuration {
  return { version: 1, families: { generic: true, semantic: false }, limits: { ...DEFAULT_LIMITS } };
}
interface ConfigIO {
  read(path: string): string;
  mkdir(path: string): void;
  write(path: string, content: string): void;
  rename(from: string, to: string): void;
  unlink(path: string): void;
}
const systemIO: ConfigIO = {
  read: path => readFileSync(path, "utf8"),
  mkdir: path => { mkdirSync(path, { recursive: true }); },
  write: (path, content) => writeFileSync(path, content, { encoding: "utf8", flag: "wx", mode: 0o600 }),
  rename: renameSync, unlink: unlinkSync,
};
/** Construct only with the host's user agent directory, never a model-supplied path. */
export class UserConfiguration {
  readonly path: string;
  constructor(private readonly agentDir: string, private readonly io: ConfigIO = systemIO) {
    this.path = join(agentDir, "decision-tools.json");
  }
  load(): Configuration {
    let text: string;
    try { text = this.io.read(this.path); }
    catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return defaultConfiguration();
      throw new ToolkitError("configuration_read_error");
    }
    try { return parseConfiguration(JSON.parse(text)); }
    catch { throw new ToolkitError("invalid_configuration"); }
  }
  saveDefault(model: ModelKey): Configuration {
    const configuration = parseConfiguration({ ...this.load(), defaultModel: model });
    const temporary = join(this.agentDir, `.decision-tools-${randomUUID()}.tmp`);
    try {
      this.io.mkdir(this.agentDir);
      this.io.write(temporary, JSON.stringify(configuration, null, 2) + "\n");
      this.io.rename(temporary, this.path);
    } catch {
      try { this.io.unlink(temporary); } catch { /* Best-effort cleanup, never delete the old default. */ }
      throw new ToolkitError("configuration_write_error");
    }
    return configuration;
  }
}
