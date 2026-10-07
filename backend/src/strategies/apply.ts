import { accumulate, type LedgerEvent } from "shared";
import { accountIdFor } from "../leaderboard/chain.js";
import { copies, strategies } from "./store.js";

export async function applyCopies(events: LedgerEvent[], head: number, ids: Map<string, number>): Promise<void> {
  const all = await copies.all();
  for (const copy of all) {
    const strategy = await strategies.get(copy.strategyId);
    if (!strategy) continue;
    let current = copy;
    if (current.accountId === null) {
      const accountId = await accountIdFor(current.follower).catch(() => null);
      if (accountId !== null) current = { ...current, accountId };
    }
    const perpIds = new Set(
      strategy.card.legs.map((leg) => ids.get(leg.symbol)).filter((id): id is number => id !== undefined),
    );
    const next = accumulate(current, events, perpIds, head);
    if (next !== copy) await copies.set(copy.id, next);
  }
}
