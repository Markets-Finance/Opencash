import {
  binById,
  loadStockTokens,
  quoteUsdgToToken,
  tokensBySymbol,
} from "shared";
import { publicClient } from "../chain.js";
import { servChatCompletion } from "../serv/client.js";
import { promptGuardTool, proposeBinActionTool, shadowAgentTool } from "../serv/tools.js";
import { getMandate } from "./mandates.js";
import { saveProposal } from "./proposals.js";
import { recordReceipt } from "./receipts.js";
import type { Proposal } from "./types.js";

export async function proposeAction(mandateId: string): Promise<Proposal> {
  const mandate = await getMandate(mandateId);
  if (!mandate) throw new Error(`Unknown mandate ${mandateId}`);

  const bin = binById(mandate.binId);
  if (!bin) throw new Error(`Unknown bin ${mandate.binId}`);

  const tokens = tokensBySymbol(await loadStockTokens());
  const legLines = await Promise.all(
    bin.legs.map(async (leg) => {
      const token = tokens.get(leg.symbol);
      if (!token) return `${leg.symbol}: not in the stock-token registry`;
      const quote = await quoteUsdgToToken(publicClient, token.tokenAddress, 1, token.tokenDecimals);
      return quote
        ? `${leg.symbol}: weight ${leg.weightBps / 100}%, price $${quote.price.toFixed(2)}`
        : `${leg.symbol}: no USDG pool found`;
    }),
  );

  const hint =
    "usdgAmount must never exceed the mandate's usdgBudget, must be 0 if any leg has no pool, " +
    "and the reasoning must cite the mandate's policy text.";

  const response = await servChatCompletion({
    messages: [
      {
        role: "system",
        content:
          "You allocate USDG into a fixed-weight basket of Robinhood Chain Stock Tokens on behalf " +
          "of a user-authored mandate. You never exceed the mandate's budget. Propose exactly one action.",
      },
      {
        role: "user",
        content: [
          `Mandate policy: ${mandate.policyText}`,
          `Mandate USDG budget: ${mandate.usdgBudget}`,
          `Bin "${bin.name}" (${bin.id}): ${bin.thesis}`,
          "Legs:",
          ...legLines,
        ].join("\n"),
      },
    ],
    tools: [promptGuardTool, shadowAgentTool(hint), proposeBinActionTool],
    toolChoice: { type: "function", function: { name: "propose_bin_action" } },
  });

  const choice = response.choices[0];
  const call = choice?.message.tool_calls?.[0];
  if (!call || call.function.name !== "propose_bin_action") {
    throw new Error("SERV did not return a propose_bin_action call");
  }

  const args = JSON.parse(call.function.arguments) as {
    binId: string;
    usdgAmount: number;
    reasoning: string;
  };

  const usdgAmount = Math.max(0, Math.min(args.usdgAmount, mandate.usdgBudget));

  const proposal = await saveProposal({
    mandateId: mandate.id,
    binId: mandate.binId,
    usdgAmount,
    reasoning: args.reasoning,
    servFinishReason: choice.finish_reason,
  });

  await recordReceipt({
    mandateId: mandate.id,
    proposalId: proposal.id,
    status: "proposed",
    detail: `Proposed $${usdgAmount} into ${bin.name}: ${args.reasoning}`,
  });

  return proposal;
}
