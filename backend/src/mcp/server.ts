import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { executeProposal } from "../agent/execute.js";
import { createMandate, getMandate } from "../agent/mandates.js";
import { proposeAction } from "../agent/propose.js";
import { receiptsForMandate } from "../agent/receipts.js";
import { isWatching, startWatch, stopWatch } from "../agent/watch.js";

const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "expected a 0x address");

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function buildAgentMcpServer(): McpServer {
  const server = new McpServer({ name: "opencash-hood-agent", version: "0.1.0" });

  server.registerTool(
    "create_mandate",
    {
      title: "Create mandate",
      description:
        "Persist a plain-English policy that bounds how much USDG a SERV-reasoning agent may allocate into a bin.",
      inputSchema: {
        binId: z.string(),
        owner: addressSchema,
        policyText: z.string(),
        usdgBudget: z.number().positive(),
        autoExecute: z.boolean().optional(),
      },
    },
    async (args) => {
      const mandate = await createMandate({
        binId: args.binId,
        owner: args.owner as `0x${string}`,
        policyText: args.policyText,
        usdgBudget: args.usdgBudget,
        autoExecute: args.autoExecute,
      });
      return textResult(mandate);
    },
  );

  server.registerTool(
    "propose_action",
    {
      title: "Propose action",
      description:
        "Ask SERV Reasoning (with prompt-guard and shadow-agent validation) how much USDG to allocate right now, given the mandate and live pricing.",
      inputSchema: { mandateId: z.string() },
    },
    async (args) => textResult(await proposeAction(args.mandateId)),
  );

  server.registerTool(
    "execute",
    {
      title: "Execute proposal",
      description:
        "Sign the proposal's swaps with the agent's authorized session key and submit them on Robinhood Chain.",
      inputSchema: { proposalId: z.string() },
    },
    async (args) => textResult(await executeProposal(args.proposalId)),
  );

  server.registerTool(
    "start_watch",
    {
      title: "Start watch",
      description:
        "Re-run propose_action for a mandate on an interval. Only auto-executes if the mandate was created with autoExecute: true.",
      inputSchema: { mandateId: z.string(), intervalSeconds: z.number().min(30) },
    },
    async (args) => {
      const mandate = await getMandate(args.mandateId);
      if (!mandate) throw new Error(`Unknown mandate ${args.mandateId}`);
      startWatch(args.mandateId, args.intervalSeconds * 1000);
      return textResult({ mandateId: args.mandateId, watching: true });
    },
  );

  server.registerTool(
    "stop_watch",
    {
      title: "Stop watch",
      description: "Stop the polling loop started by start_watch.",
      inputSchema: { mandateId: z.string() },
    },
    async (args) => {
      stopWatch(args.mandateId);
      return textResult({ mandateId: args.mandateId, watching: isWatching(args.mandateId) });
    },
  );

  server.registerTool(
    "get_receipt",
    {
      title: "Get receipts",
      description: "Every proposal and execution outcome recorded for a mandate, oldest first.",
      inputSchema: { mandateId: z.string() },
    },
    async (args) => textResult(await receiptsForMandate(args.mandateId)),
  );

  return server;
}
