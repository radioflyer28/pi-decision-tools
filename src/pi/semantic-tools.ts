import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Usage } from "../core/contracts.js";
import { errorCode, requireThat } from "../core/errors.js";
import { copyJson } from "../core/validation.js";
import { filterSchema, searchSchema, semanticResultsSchema, semanticContinueSchema, evidenceInputSchema,
  semanticEnvelopeSchema, evidenceEnvelopeSchema, type SemanticEnvelope, type EvidenceEnvelope } from "../semantic/schemas.js";
import { parseFilter, parseSearch, parseSemanticContinue, SEMANTIC_BOUNDS } from "../semantic/validation.js";
import type { SessionOwner } from "./owner.js";

export function registerSemanticTools(pi: ExtensionAPI, owner: SessionOwner, enabled: boolean): void {
  const definitions = [
    { name: "semantic_search", schema: searchSchema, description: "Search safely captured project-file passages with shared authorized execution. Default systematic scans every eligible passage within limits. Explicit discovery yields additional qualifying hits (targetMatches default5), never pads weak hits, and permits continuation. No lexical prefilter or expansion. Omit run to prepare." },
    { name: "semantic_filter", schema: filterSchema, description: "Filter identified caller-supplied records with an experimental semantic rubric and shared authorized classifier execution. Provenance is unverified; no source files are read." },
    { name: "semantic_results", schema: semanticResultsSchema, description: "Read or re-filter bounded retained results without classifier calls. Discovery defaults to new_matches from the latest execution; matches shows cumulative qualifying hits and all shows every outcome. Raw answers, stopping policy and full coverage remain unchanged." },
    { name: "semantic_continue", schema: semanticContinueSchema, description: "Resume retained pending records/file passages or explicitly retry eligible failures under the original identity/model/shared allowance. Discovery seeks another additional-hit increment; optional targetMatches replaces its per-call target. New query/scope requires a new search." },
    { name: "semantic_evidence", schema: evidenceInputSchema, description: "Retrieve bounded plain captured record/file snippets without classifier calls. checkCurrent verifies only owned captured file identity, never caller provenance; historical text is not replaced." },
  ] as const;
  for (const definition of definitions) pi.registerTool({
    name: definition.name, label: definition.name, description: definition.description,
    parameters: definition.schema, outputSchema: definition.name === "semantic_evidence" ? evidenceEnvelopeSchema : semanticEnvelopeSchema,
    exposure: enabled ? "codemode" : "hidden",
    async execute(_id, raw, signal, _update, ctx) {
      let data: SemanticEnvelope | EvidenceEnvelope, usage: Usage | undefined;
      try {
        const sessionId = ctx.sessionManager.getSessionId(), service = owner.semantic(sessionId);
        if (definition.name === "semantic_results") data = service.results.page(raw);
        else if (definition.name === "semantic_evidence") data = await service.results.evidence(raw, signal ? { signal } : {});
        else {
          const input = definition.name === "semantic_filter" ? parseFilter(raw) : definition.name === "semantic_search" ? parseSearch(raw) : parseSemanticContinue(raw);
          const core = owner.current(sessionId);
          core.controls.authorize("semantic");
          await core.classifier.refresh();
          // A refresh must never transfer a call into a new runtime or tree generation.
          requireThat(owner.semantic(sessionId) === service, "runtime_expired");
          const result = definition.name === "semantic_filter"
            ? await service.execution.filter(input, signal ? { signal } : {})
            : definition.name === "semantic_search" ? await service.execution.search(input, signal ? { signal } : {})
            : await service.execution.continue(input, signal ? { signal } : {});
          usage = result.usageDelta;
          data = service.results.page({ operationId: result.operationId }, result.error);
        }
      } catch (error) {
        const code = errorCode(error, "invalid_input"); data = { ok: false, error: { code, message: code } };
      }
      return { content: [{ type: "text" as const, text: data.ok ? `Semantic operation ${data.value.operationId}` : data.error.code }],
        details: {}, structuredContent: copyJson(data, SEMANTIC_BOUNDS.pageBytes), isError: !data.ok,
        ...(usage ? { usage } : {}) };
    },
  });
}
