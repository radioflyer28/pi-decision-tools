import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { installOwner } from "./pi/owner.js";
import { UserConfiguration } from "./pi/config.js";
import { registerCommands, startupOptIn } from "./pi/commands.js";
import { registerLifecycle } from "./pi/lifecycle.js";
import { registerGenericTools } from "./pi/generic-tools.js";
import { registerSemanticTools } from "./pi/semantic-tools.js";

export default function extension(pi: ExtensionAPI): void {
  const owner = installOwner(pi);
  if (!owner) return;
  const store = new UserConfiguration(getAgentDir());
  registerCommands(pi, owner, store);
  registerLifecycle(pi, owner, () => store.load(), async (ctx, config, initial) => {
    registerGenericTools(pi, owner, config.families.generic);
    registerSemanticTools(pi, owner, config.families.semantic);
    await startupOptIn(pi, owner, ctx, config, initial);
  });
}
