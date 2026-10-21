import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Configuration, ModelKey } from "../core/contracts.js";
import { selectModel } from "../core/controls.js";
import { errorCode, requireThat } from "../core/errors.js";
import { integer, parseLimits } from "../core/validation.js";
import type { UserConfiguration } from "./config.js";
import type { SessionOwner } from "./owner.js";

function explicit(args: string[]): ModelKey | undefined {
  requireThat(args.length === 0 || args.length === 2, "invalid_input");
  return args.length ? { provider: args[0]!, id: args[1]! } : undefined;
}
export function registerCommands(pi: ExtensionAPI, owner: SessionOwner, store: UserConfiguration): void {
  pi.registerFlag("decisions-enable", { type: "boolean", default: false, description: "Explicitly authorize initial-startup decision execution (requires model and budget)." });
  pi.registerFlag("decisions-model", { type: "string", description: "Exact provider/model-id for initial startup opt-in." });
  pi.registerFlag("decisions-budget", { type: "string", description: "Full finite limits JSON for initial startup opt-in." });
  pi.registerCommand("decisions", { description: "Decision toolkit status, enable, disable, model, default, replenish, or release.",
    async handler(args, ctx) {
      try {
        const [command = "status", ...words] = args.trim() ? args.trim().split(/\s+/) : [];
        const coordinator = owner.current(ctx.sessionManager.getSessionId());
        const current = () => requireThat(owner.current(ctx.sessionManager.getSessionId()) === coordinator, "runtime_expired");
        if (command === "status") {
          requireThat(words.length === 0, "invalid_input");
          let readiness = "ready";
          try { coordinator.controls.ledger.read(); } catch (error) {
            readiness = errorCode(error, "storage_error");
            if (readiness === "storage_error") coordinator.disable();
          }
          ctx.ui.notify(JSON.stringify({ enabled: coordinator.controls.enabled, readiness,
            model: coordinator.controls.selected ?? null, limits: coordinator.controls.limits,
            families: coordinator.controls.families,
            ledger: coordinator.controls.ledger.snapshot().totals }), "info"); return;
        }
        if (command === "disable") {
          requireThat(words.length === 0, "invalid_input"); await owner.pause();
          ctx.ui.notify("Decision processing disabled; started attempts remain charged.", "info"); return;
        }
        if (command === "release") {
          requireThat(words.length === 1, "invalid_input"); owner.release(ctx.sessionManager.getSessionId(), words[0]!);
          ctx.ui.notify("Workspace released; allowance unchanged.", "info"); return;
        }
        if (command === "replenish") {
          requireThat(words.length === 2 && words.every(w => /^(0|[1-9]\d*)$/.test(w)), "invalid_input");
          const requests = integer(Number(words[0])), bytes = integer(Number(words[1]));
          const totals = coordinator.controls.ledger.snapshot().totals;
          const message = `Add ${requests} requests / ${bytes} input bytes. Previous grants: ${totals.grantedRequests} / ${totals.grantedInputBytes}. Charges and unknown usage remain.`;
          if (ctx.hasUI && !await ctx.ui.confirm("Replenish decision allowance?", message)) return;
          current(); coordinator.controls.replenish(requests, bytes);
          ctx.ui.notify(JSON.stringify(coordinator.controls.ledger.snapshot().totals), "info"); return;
        }
        requireThat(["enable", "model", "default"].includes(command), "invalid_command");
        const requested = explicit(words), config = store.load();
        await coordinator.classifier.refresh(); current();
        const available = coordinator.classifier.available();
        let selected: ModelKey;
        try { selected = selectModel(available, requested ?? (command === "enable" ? coordinator.controls.selected : undefined), config.defaultModel); }
        catch (error) {
          if (errorCode(error) !== "model_ambiguous" || !ctx.hasUI) throw error;
          const names = available.map(m => `${m.provider}/${m.id}`);
          const choice = await ctx.ui.select("Choose decision classifier", names);
          if (choice === undefined) return;
          const index = names.indexOf(choice); requireThat(index >= 0, "model_unavailable"); selected = available[index]!;
        }
        current();
        if (command === "enable") {
          const warning = `Authorize ${selected.provider}/${selected.id} with limits ${JSON.stringify(coordinator.controls.limits)}? Submitted evidence is sent to this provider and may appear in the Pi transcript.`;
          if (ctx.hasUI && !await ctx.ui.confirm("Enable decision processing?", warning)) return;
          current(); owner.enable(ctx.sessionManager.getSessionId(), selected);
        } else if (command === "model") coordinator.controls.select(selected);
        else store.saveDefault({ provider: selected.provider, id: selected.id });
        ctx.ui.notify(`${command}: ${selected.provider}/${selected.id}`, "info");
      } catch (error) { ctx.ui.notify(errorCode(error, "invalid_input"), "error"); }
    },
  });
}
export async function startupOptIn(pi: ExtensionAPI, owner: SessionOwner, ctx: ExtensionContext,
  _config: Configuration, initial: boolean): Promise<void> {
  if (!initial || pi.getFlag("decisions-enable") !== true) return;
  const encodedModel = pi.getFlag("decisions-model"), encodedBudget = pi.getFlag("decisions-budget");
  requireThat(typeof encodedModel === "string" && typeof encodedBudget === "string", "invalid_startup_flags");
  const slash = encodedModel.indexOf("/");
  requireThat(slash > 0 && slash < encodedModel.length - 1, "invalid_startup_flags");
  const limits = parseLimits(JSON.parse(encodedBudget));
  const coordinator = owner.current(ctx.sessionManager.getSessionId());
  await coordinator.classifier.refresh();
  requireThat(owner.current(ctx.sessionManager.getSessionId()) === coordinator, "runtime_expired");
  owner.enable(ctx.sessionManager.getSessionId(), { provider: encodedModel.slice(0, slash), id: encodedModel.slice(slash + 1) }, limits);
}
