import { createToolbox, defaultLimits, perpl, tickBot, type Toolbox } from "shared";
import type { Address } from "viem";
import { contextFor, type Net } from "../analytics/context.js";
import { claimLock } from "../lock.js";
import { smartPulse } from "../nansen/pulse.js";
import { chainReads, createApiDeps } from "./adapter.js";
import { listBots, saveBot, type ServerBot } from "./store.js";
import { loadKey } from "./vault.js";

const toolboxes = new Map<Net, Toolbox>();

function toolboxFor(net: Net): Toolbox {
  let toolbox = toolboxes.get(net);
  if (!toolbox) {
    toolbox = createToolbox(perpl.createPerplApi(contextFor(net).deployment.apiUrl), defaultLimits);
    toolboxes.set(net, toolbox);
  }
  return toolbox;
}

async function pulses(symbols: string[]) {
  try {
    return (await smartPulse(symbols)).pulses;
  } catch {
    return null;
  }
}

function stopped(bot: ServerBot, message: string): ServerBot {
  return {
    ...bot,
    enabled: false,
    status: "halted",
    log: [{ at: Date.now(), level: "error" as const, message }, ...bot.log].slice(0, 60),
  };
}

export async function tickOwner(owner: string, net: Net, bots: ServerBot[]): Promise<void> {
  const stored = await loadKey(owner, net);
  if (!stored) {
    for (const bot of bots) await saveBot(stopped(bot, "No trade key saved for this wallet"));
    return;
  }
  const { deployment } = contextFor(net);
  const key = perpl.tradeKeyFromHex(stored.secretHex);
  const trade = perpl.createTradeClient({ apiUrl: deployment.apiUrl, chainId: deployment.chainId, apiKey: stored.apiKey, secret: key.secret });
  const reads = chainReads(net, owner as Address);
  for (const bot of bots) {
    const deps = createApiDeps({ bot, others: () => bots, toolbox: toolboxFor(net), trade, reads, pulses });
    const next = await tickBot(bot, deps);
    await saveBot({ ...next, owner: bot.owner, net: bot.net, mandate: bot.mandate });
  }
}

export async function tickAll(): Promise<void> {
  const active = await listBots({ enabled: true });
  const groups = new Map<string, ServerBot[]>();
  for (const bot of active) {
    const key = `${bot.net}:${bot.owner.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), bot]);
  }
  await Promise.allSettled(
    [...groups.entries()].map(([key, bots]) => {
      const [net, owner] = key.split(":") as [Net, string];
      return tickOwner(owner, net, bots).catch((error) => console.error(`runner ${key} failed`, error));
    }),
  );
}

export async function startRunner(intervalMs = 30_000): Promise<boolean> {
  if (!(await claimLock("data/bot-runner.lock"))) {
    console.error("bot runner: another process owns the runner, this one will not trade");
    return false;
  }
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      await tickAll();
    } finally {
      busy = false;
    }
  };
  setInterval(() => void run(), intervalMs);
  void run();
  return true;
}
