import { summarise } from "./accounts.js";
import { addressBook } from "./addresses.js";
import type { Net } from "./context.js";
import { storeFor } from "./store.js";
import { pnlTier } from "./wallet.js";

export type LeaderSort = "pnl" | "volume" | "winRate";

const minClosedTrades = 5;
const minVolumeUsd = 1000;
const cacheMs = 30_000;
const cache = new Map<string, { at: number; value: unknown }>();

export function parseSort(value: unknown): LeaderSort {
  return value === "volume" || value === "winRate" ? value : "pnl";
}

export async function leaderboardView(net: Net, sort: LeaderSort, limit = 25) {
  const key = `${net}:${sort}:${limit}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < cacheMs) return hit.value as Awaited<ReturnType<typeof build>>;
  const value = await build(net, sort, limit);
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function build(net: Net, sort: LeaderSort, limit: number) {
  const store = storeFor(net);
  const saved = await store.snapshot();
  const rows = Object.entries(saved.accounts)
    .map(([id, agg]) => ({ accountId: Number(id), ...summarise(agg) }))
    .filter((row) => row.closedTrades >= minClosedTrades && row.volumeUsd >= minVolumeUsd)
    .sort((a, b) => (sort === "volume" ? b.volumeUsd - a.volumeUsd : sort === "winRate" ? b.winRate - a.winRate || b.netPnlUsd - a.netPnlUsd : b.netPnlUsd - a.netPnlUsd))
    .slice(0, limit);

  const book = await addressBook(net, rows.map((row) => row.accountId));

  return {
    network: net,
    sort,
    syncedAt: saved.syncedAt,
    indexedHours: store.coveredHours(),
    targetHours: store.targetHours(),
    backfilling: !store.progress.done,
    ranked: Object.keys(saved.accounts).length,
    rows: rows.map((row, index) => ({
      rank: index + 1,
      accountId: row.accountId,
      address: book.get(row.accountId) ?? null,
      netPnlUsd: row.netPnlUsd,
      volumeUsd: row.volumeUsd,
      winRate: row.winRate,
      profitFactor: row.profitFactor,
      closedTrades: row.closedTrades,
      maxDrawdownUsd: row.maxDrawdownUsd,
      liquidations: row.liquidations,
      tier: pnlTier(row.netPnlUsd),
    })),
  };
}

