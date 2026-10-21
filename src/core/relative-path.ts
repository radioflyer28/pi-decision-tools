import { requireThat } from "./errors.js";

/** Accommodates 256 x 4096-byte paths including worst-case JSON escaping. */
export const PATH_JSON_BYTES = 8_388_608;

/** Pure portable scope syntax; never resolves paths or touches the filesystem. */
export function relativePath(value: unknown, windows = process.platform === "win32"): string {
  requireThat(typeof value === "string" && value.length > 0 && Buffer.byteLength(value) <= 4096);
  requireThat(Buffer.from(value, "utf8").toString("utf8") === value);
  requireThat(!/^[\\/]|[:\u0000*?\[\]]/.test(value));
  const parts = value.split(/[\\/]+/).filter(part => part !== "." && part !== "");
  requireThat(parts.length > 0 && !parts.includes(".."));
  if (windows) for (const part of parts) {
    requireThat(!/[. ]$|[<>"|\u0001-\u001f]/.test(part));
    requireThat(!/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part));
  }
  return parts.join("/");
}
export function pathKey(value: string, windows = process.platform === "win32"): string {
  return windows ? value.toLowerCase() : value;
}
export function relativePaths(value: unknown, allowEmpty = false, windows = process.platform === "win32"): string[] {
  requireThat(Array.isArray(value) && value.length >= (allowEmpty ? 0 : 1) && value.length <= 256);
  const paths = value.map(item => relativePath(item, windows));
  requireThat(new Set(paths.map(path => pathKey(path, windows))).size === paths.length);
  return paths;
}
export function withinPath(path: string, prefix: string, windows = process.platform === "win32"): boolean {
  const p = pathKey(path, windows), base = pathKey(prefix, windows);
  return p === base || p.startsWith(base + "/");
}
