import { createHash } from "node:crypto";
import { ToolkitError } from "../core/errors.js";
import { FILE_BOUNDS } from "./policy.js";
export interface WindowRange { startLine: number; endLine: number; startByte: number; endByte: number; textHash: string }
export interface ExcludedRange { startLine: number; endLine: number; reason: "line_too_large" }
export interface WindowPreparation { windows: WindowRange[]; excluded: ExcludedRange[]; complete: boolean }
export function hashBytes(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
/** Byte offsets preserve all original terminators; line indexing never retains a per-byte/per-line array. */
export function prepareWindows(bytes: Buffer, maximum: number = FILE_BOUNDS.windows): WindowPreparation {
  if (bytes.length > FILE_BOUNDS.fileBytes) throw new ToolkitError("file_too_large");
  if (!Number.isSafeInteger(maximum) || maximum < 0 || maximum > FILE_BOUNDS.windows) throw new ToolkitError("invalid_input");
  try { new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new ToolkitError("binary_or_encoding"); }
  if (bytes.includes(0)) throw new ToolkitError("binary_or_encoding");
  const windows: WindowRange[] = [], excluded: ExcludedRange[] = [];
  const lineEnd = (offset: number) => { const lf = bytes.indexOf(10, offset); return lf < 0 ? bytes.length : lf + 1; };
  let start = 0, line = 1;
  while (start < bytes.length) {
    if (lineEnd(start) - start > FILE_BOUNDS.windowBytes) {
      excluded.push({ startLine: line, endLine: line, reason: "line_too_large" }); start = lineEnd(start); line++; continue;
    }
    if (windows.length >= maximum) return { windows, excluded, complete: false };
    const starts: number[] = []; let end = start;
    while (end < bytes.length && starts.length < FILE_BOUNDS.windowLines) {
      const next = lineEnd(end);
      if (next - start > FILE_BOUNDS.windowBytes) break;
      starts.push(end); end = next;
    }
    windows.push({ startLine: line, endLine: line + starts.length - 1, startByte: start, endByte: end,
      textHash: hashBytes(bytes.subarray(start, end)) });
    if (end === bytes.length) break;
    const advance = lineEnd(end) - end > FILE_BOUNDS.windowBytes ? starts.length : Math.max(1, starts.length - FILE_BOUNDS.overlapLines);
    start = starts[advance] ?? end; line += advance;
  }
  return { windows, excluded, complete: true };
}
export function passageText(bytes: Buffer, range: Pick<WindowRange, "startByte" | "endByte">): string {
  const text = bytes.subarray(range.startByte, range.endByte).toString("utf8");
  return range.startByte === 0 ? text.replace(/^\uFEFF/, "") : text;
}
