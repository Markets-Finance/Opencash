import { botMandateMessage, perpl, templates } from "shared";
import { verifyMessage, type Address } from "viem";
import { contextFor, type Net } from "../analytics/context.js";
import { loadKey } from "../runner/vault.js";
import { perplLiveDeps } from "./perplDeps.js";
import type { ServerLiveBot } from "./store.js";

export async function tradeClientFor(owner: string, net: Net): Promise<perpl.TradeClient | null> {
  const stored = await loadKey(owner, net);
  if (!stored) return null;
  const { deployment } = contextFor(net);
  const key = perpl.tradeKeyFromHex(stored.secretHex);
  return perpl.createTradeClient({ apiUrl: deployment.apiUrl, chainId: deployment.chainId, apiKey: stored.apiKey, secret: key.secret });
}

export async function liveDepsFor(owner: string, net: Net): Promise<templates.LiveDeps> {
  const trade = await tradeClientFor(owner, net);
  if (!trade) throw new Error("No trade key saved for this wallet");
  return perplLiveDeps(net, owner, trade);
}

export function dryRunDeps(owner: string, net: Net, intents: string[]): templates.LiveDeps {
  const reads = perplLiveDeps(net, owner, null);
  const px = (value: number) => Number(value.toPrecision(6));
  let virtual: templates.LivePosition | null = null;
  return {
    ...reads,
    position: async (symbol) => virtual ?? reads.position(symbol),
    enter: async (symbol, usd, { reduceOnly }) => {
      const mark = await reads.markPrice!(symbol);
      const held = virtual ?? (await reads.position(symbol));
      if (mark > 0) virtual = { qty: held.qty + usd / mark, avgPx: mark };
      intents.push(`${usd > 0 ? "Buy" : "Sell"} $${Math.abs(usd).toFixed(2)} at market${reduceOnly ? " (reduce only)" : ""}`);
    },
    exit: async () => {
      virtual = { qty: 0, avgPx: 0 };
      intents.push("Close the whole position at market");
    },
    guard: async (maxLossUsd) => {
      if (maxLossUsd !== null) intents.push(`Watch a stop that risks about $${px(maxLossUsd)}`);
      return { allowed: true, reason: "" };
    },
  };
}

export async function liveMandateIssue(bot: ServerLiveBot): Promise<string | null> {
  if (templates.liveDigest(bot) !== bot.mandate.digest) return "Bot settings no longer match the signed mandate";
  const message = botMandateMessage(bot.owner, bot.net, bot.mandate.digest, bot.mandate.issuedAt);
  const valid = await verifyMessage({ address: bot.owner as Address, message, signature: bot.mandate.signature as `0x${string}` }).catch(() => false);
  return valid ? null : "Stored mandate signature is not from the owner";
}
