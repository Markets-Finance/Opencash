import { perpl } from "shared";
import type { Address } from "viem";
import { contextFor, type Net } from "../analytics/context.js";
import { heldPositions, marketBook } from "../analytics/positions.js";
import { storeFor } from "../analytics/store.js";
import type { ServerLiveBot } from "./store.js";

export type LiveMetrics = {
  fills: number;
  volumeUsd: number;
  feesUsd: number;
  realizedUsd: number;
  unrealizedUsd: number;
  netUsd: number;
  returnPct: number;
  positionSize: number;
  entryPx: number | null;
  indexedHours: number;
};

export async function metricsFor(owner: string, net: Net, bots: ServerLiveBot[]): Promise<Map<string, LiveMetrics>> {
  const result = new Map<string, LiveMetrics>();
  const started = bots.filter((b) => b.startedAt !== null);
  if (started.length === 0) return result;
  const { client, deployment } = contextFor(net);
  const account = await perpl.fetchAccount(client, deployment.exchange, owner as Address);
  if (!account) return result;
  const [{ markets }, held] = await Promise.all([marketBook(net), heldPositions(net, account.accountId)]);
  const perpIdOf = new Map(markets.map((m) => [m.symbol, m.perpId]));
  const store = storeFor(net);
  const saved = await store.snapshot();
  const id = Number(account.accountId);
  for (const bot of started) {
    const perpId = perpIdOf.get(bot.symbol);
    const mine = saved.events.filter((e) => e.kind !== "account" && e.kind !== "cash" && e.accountId === id && e.perpId === perpId && store.timeOf(e.block) >= bot.startedAt!);
    let fills = 0;
    let volumeUsd = 0;
    let feesUsd = 0;
    let pnlUsd = 0;
    for (const event of mine) {
      if (event.kind === "fill") {
        fills += 1;
        volumeUsd += event.volumeUsd;
        feesUsd += event.feeUsd;
      } else if (event.kind === "pnl") {
        pnlUsd += event.pnlUsd + event.fundingUsd;
      }
    }
    const position = held.find((p) => p.symbol === bot.symbol);
    const realizedUsd = pnlUsd - feesUsd;
    const unrealizedUsd = position?.unrealizedPnlUsd ?? 0;
    const netUsd = realizedUsd + unrealizedUsd;
    result.set(bot.id, {
      fills,
      volumeUsd,
      feesUsd,
      realizedUsd,
      unrealizedUsd,
      netUsd,
      returnPct: (netUsd / bot.allocationUsd) * 100,
      positionSize: position ? (position.side === "long" ? position.lots : -position.lots) : 0,
      entryPx: position ? position.entryPrice : null,
      indexedHours: store.coveredHours(),
    });
  }
  return result;
}
