import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ExecutionResult } from "../core/contracts.js";
import { errorCode } from "../core/errors.js";
import { BOUNDS, copyJson, parseContinue, parseResults, parseSubmit } from "../core/validation.js";
import { continueSchema, envelopeSchema, resultsSchema, submitSchema } from "./schemas.js";
import type { SessionOwner } from "./owner.js";

export function registerGenericTools(pi: ExtensionAPI, owner: SessionOwner, enabled: boolean): void {
  const definitions = [
    { name: "decision_submit", schema: submitSchema, description: "Prepare or execute bounded native-classifier items under explicit user authorization. Inspect ok and per-item outcomes." },
    { name: "decision_results", schema: resultsSchema, description: "Read a bounded page from a live ephemeral batch without provider work or new usage." },
    { name: "decision_continue", schema: continueSchema, description: "Continue pending items, or explicitly retry eligible failures, under the same pinned identity and shared allowance." },
  ] as const;
  for (const definition of definitions) pi.registerTool({
    name: definition.name, label: definition.name, description: definition.description,
    parameters: definition.schema, outputSchema: envelopeSchema, exposure: enabled ? "codemode" : "hidden",
    async execute(_id, raw, signal, _update, ctx) {
      let result: ExecutionResult;
      try {
        const client = owner.client(ctx.sessionManager.getSessionId(), "generic");
        const options = signal ? { signal } : {};
        if (definition.name === "decision_submit") result = await client.submit(parseSubmit(raw), options);
        else if (definition.name === "decision_continue") result = await client.continue(parseContinue(raw), options);
        else result = client.results(parseResults(raw));
      } catch (error) {
        const code = errorCode(error, "invalid_input");
        result = { data: { ok: false, error: { code, message: code } } };
      }
      const text = result.data.ok ? `Batch ${result.data.value.batchId}: ${result.data.value.state}; ${result.data.value.stopReason}` : result.data.error.code;
      return { content: [{ type: "text" as const, text }], details: {},
        structuredContent: copyJson(result.data, BOUNDS.pageBytes), isError: !result.data.ok,
        ...(result.usageDelta ? { usage: result.usageDelta } : {}) };
    },
  });
}
