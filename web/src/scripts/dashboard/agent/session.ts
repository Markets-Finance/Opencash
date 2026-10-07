import { createToolbox, defaultLimits, perpl, runTool, type ToolOutcome } from "shared";

const backend = import.meta.env.PUBLIC_BACKEND_URL ?? "http://localhost:8787";

export const toolbox = createToolbox(perpl.createPerplApi(`${backend}/perpl`), defaultLimits);

export function run(name: string, args: Record<string, unknown>): Promise<ToolOutcome> {
  return runTool(name, args, toolbox);
}
