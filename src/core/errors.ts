/** Codes, never input/provider messages, are safe to surface in routine diagnostics. */
export class ToolkitError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ToolkitError";
  }
}
export function requireThat(condition: unknown, code = "invalid_input"): asserts condition {
  if (!condition) throw new ToolkitError(code);
}
export function errorCode(error: unknown, fallback = "provider_error"): string {
  return error instanceof ToolkitError ? error.code : fallback;
}
