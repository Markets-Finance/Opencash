import type { ServTool } from "./client.js";

// SERV strips every serv_* tool before the model runs — these never appear
// as tool calls in the response. Options are read from each parameter's
// `default`, never from call-time arguments.
export const promptGuardTool: ServTool = {
  type: "function",
  function: { name: "serv_prompt_guard" },
};

export function shadowAgentTool(hint: string, maxIterations = 5): ServTool {
  return {
    type: "function",
    function: {
      name: "serv_shadow_agent",
      description: "Independently re-validate the proposal against the hint before it ships.",
      parameters: {
        type: "object",
        properties: {
          hint: { type: "string", default: hint },
          max_iterations: { type: "integer", default: maxIterations },
        },
      },
    },
  };
}

export const proposeBinActionTool: ServTool = {
  type: "function",
  function: {
    name: "propose_bin_action",
    description:
      "Propose how much USDG to allocate to a bin right now, given its mandate and live pricing.",
    parameters: {
      type: "object",
      properties: {
        binId: { type: "string" },
        usdgAmount: {
          type: "number",
          description: "USDG to allocate. 0 means: do nothing this tick.",
        },
        reasoning: {
          type: "string",
          description: "One or two sentences on why this amount, tied to the mandate.",
        },
      },
      required: ["binId", "usdgAmount", "reasoning"],
    },
  },
};
