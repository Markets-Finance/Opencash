import { templates } from "shared";
import type { Net } from "../analytics/context.js";
import { liveMandateIssue, tradeClientFor } from "./deps.js";
import { perplLiveDeps } from "./perplDeps.js";
import { getLive, listLive, saveLive, withLiveLock, type ServerLiveBot } from "./store.js";

export function halted(bot: ServerLiveBot, message: string): ServerLiveBot {
  return { ...bot, enabled: false, status: "halted", log: [{ at: Date.now(), level: "error" as const, message }, ...bot.log].slice(0, 60) };
}

async function tickLiveOwner(owner: string, net: Net, ids: string[]): Promise<void> {
  const trade = await tradeClientFor(owner, net);
  const deps = trade ? perplLiveDeps(net, owner, trade) : null;
  for (const id of ids) {
    await withLiveLock(id, async () => {
      const bot = await getLive(id);
      if (!bot || !bot.enabled || bot.status === "halted") return;
      if (!deps) return saveLive(halted(bot, "No trade key saved for this wallet"));
      const issue = await liveMandateIssue(bot);
      if (issue) return saveLive(halted(bot, issue));
      const next = await templates.tickLive(bot, deps);
      await saveLive({ ...next, owner: bot.owner, net: bot.net, mandate: bot.mandate });
    });
  }
}

export async function tickLiveAll(): Promise<void> {
  const groups = new Map<string, string[]>();
  for (const bot of await listLive({ enabled: true })) {
    const key = `${bot.net}:${bot.owner.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), bot.id]);
  }
  await Promise.allSettled(
    [...groups.entries()].map(([key, ids]) => {
      const [net, owner] = key.split(":") as [Net, string];
      return tickLiveOwner(owner, net, ids).catch((error) => console.error(`live runner ${key} failed`, error));
    }),
  );
}
