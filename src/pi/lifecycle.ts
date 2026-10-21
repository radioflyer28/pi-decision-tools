import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Configuration } from "../core/contracts.js";
import { Coordinator } from "../core/coordinator.js";
import { ExecutionControls } from "../core/controls.js";
import { errorCode } from "../core/errors.js";
import { ClassifierAdapter } from "./classifier-adapter.js";
import { SessionLedger } from "./session-adapter.js";
import type { SessionOwner } from "./owner.js";

export function registerLifecycle(pi: ExtensionAPI, owner: SessionOwner, load: () => Configuration,
  started: (ctx: ExtensionContext, config: Configuration, initialStartup: boolean) => Promise<void>): void {
  let sequence = 0, first = true;
  pi.on("session_start", async (event, ctx) => {
    const token = ++sequence, initial = first && event.reason === "startup"; first = false;
    await owner.retire();
    if (token !== sequence) return;
    try {
      const config = load();
      const ledger = new SessionLedger(ctx.sessionManager, (type, data) => pi.appendEntry(type, data));
      const classifier = new ClassifierAdapter(ctx.modelRegistry);
      const controls = new ExecutionControls(ledger, classifier.available, config);
      owner.attach(new Coordinator(controls, classifier), { root: ctx.cwd, fileExclusions: config.fileExclusions ?? [] });
      await started(ctx, config, initial);
    } catch (error) {
      owner.coordinator?.disable();
      ctx.ui.notify(errorCode(error, "invalid_configuration"), "error");
    }
  });
  pi.on("session_before_tree", async () => { await owner.pause(); });
  pi.on("session_tree", async () => { await owner.navigate(); });
  pi.on("session_before_switch", async () => { await owner.pause(); });
  pi.on("session_before_fork", async () => { await owner.pause(); });
  // Compaction deliberately has no clearing/reset handler: all-branch ledger and
  // current in-memory generation survive it.
  pi.on("session_shutdown", async event => {
    sequence++;
    if (event.reason === "reload" || event.reason === "quit") await owner.dispose();
    else await owner.retire();
  });
}
