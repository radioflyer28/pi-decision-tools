import { ToolkitError } from "../core/errors.js";
import { copyJson, exact } from "../core/validation.js";
import { relativePaths, withinPath, PATH_JSON_BYTES } from "../core/relative-path.js";

export const FILE_BOUNDS = Object.freeze({ entries: 10_000, files: 256, fileBytes: 1_048_576,
  windows: 2048, windowLines: 64, windowBytes: 8192, overlapLines: 8, exclusions: 100,
  discoveryBytes: 8_388_608, processMs: 10_000 });
export interface Scope { paths?: string[] }
export type ExclusionReason = "outside_root" | "link" | "nonregular" | "nested_repository" |
  "sensitive" | "dependency_generated" | "user_excluded" | "missing" | "unreadable" |
  "changed" | "unverifiable" | "file_too_large" | "binary_or_encoding" | "empty" | "line_too_large";
export function parseScope(value: unknown, windows = process.platform === "win32"): Scope {
  try {
    const input = exact(copyJson(value, PATH_JSON_BYTES), [], ["paths"]);
    return Object.hasOwn(input, "paths") ? { paths: relativePaths(input.paths, false, windows) } : {};
  } catch { throw new ToolkitError("scope_invalid"); }
}
const sensitiveSegments = new Set([".ssh", ".aws", ".azure", ".gnupg", "credentials", "secrets"]);
const sensitiveNames = new Set([".npmrc", ".pypirc", "credentials.json", "credentials.yml", "credentials.yaml",
  "secrets.json", "secrets.yml", "secrets.yaml", "id_rsa", "id_dsa", "id_ecdsa", "id_ed25519"]);
const generatedSegments = new Set(["node_modules", ".git", "vendor", "dist", "build", "coverage", ".venv", "__pycache__"]);
const generatedNames = new Set(["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb",
  "poetry.lock", "pipfile.lock", "cargo.lock", "go.sum"]);
const asciiLower = (value: string) => value.replace(/[A-Z]/g, char => char.toLowerCase());
export function exclusionFor(path: string, user: readonly string[] = [], windows = process.platform === "win32"): ExclusionReason | null {
  const parts = path.split("/").map(asciiLower), name = parts.at(-1)!;
  if (parts.some(part => sensitiveSegments.has(part)) || name === ".env" || name.startsWith(".env.") ||
    sensitiveNames.has(name) || /\.(pem|key|p12|pfx)$/.test(name)) return "sensitive";
  if (parts.some(part => generatedSegments.has(part)) || generatedNames.has(name) || name.endsWith(".map")) return "dependency_generated";
  if (user.some(prefix => withinPath(path, prefix, windows))) return "user_excluded";
  return null;
}
export function ordinalPaths(paths: string[]): string[] { return paths.sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))); }
