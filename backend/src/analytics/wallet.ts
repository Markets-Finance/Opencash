import { isAddress, type Address } from "viem";
import { perpl } from "shared";
import { summarise } from "./accounts.js";
import { contextFor, type Net } from "./context.js";
import { heldPositions, marketBook } from "./positions.js";
import { storeFor } from "./store.js";

const tiers = [
  { max: 250, name: "Shrimp" },
  { max: 1_000, name: "Fish" },
  { max: 10_000, name: "Dolphin" },
  { max: 100_000, name: "Shark" },
  { max: 1_000_000, name: "Whale" },
  { max: Infinity, name: "Leviathan" },
];

function equityTier(equity: number): string {
  return tiers.find((tier) => equity < tier.max)!.name;
}

export function pnlTier(pnl: number): string {
  if (pnl <= -1_000) return "Rekt";
  if (pnl <= -100) return "Bleeding";
  if (pnl < 100) return "Flat";
  if (pnl < 1_000) return "Green";
  return "Printer";
}

export async function walletView(net: Net, input: string) {
  if (!isAddress(input)) return { error: "Enter a valid Monad address." as const };
  const address = input as Address;
  const { client, deployment } = contextFor(net);
  const account = await perpl.fetchAccount(client, deployment.exchange, address);
  if (account === null) return { found: false as const, network: net, address };

  const { markets } = await marketBook(net);
  const held = await heldPositions(net, account.accountId);

  const symbolOf = new Map(markets.map((m) => [m.perpId, m.symbol]));
  const store = storeFor(net);
  const saved = await store.snapshot();
  const id = Number(account.accountId);
  const mine = saved.events.filter((e) => e.kind !== "account" && e.accountId === id);
  const agg = saved.accounts[id];
  const stats = agg ? summarise(agg) : null;
  const bySymbol = agg
    ? Object.entries(agg.byPerp)
        .map(([perp, tally]) => ({ symbol: symbolOf.get(Number(perp)) ?? `#${perp}`, pnlUsd: tally.pnlUsd, closes: tally.closes, winRate: tally.closes > 0 ? tally.wins / tally.closes : 0 }))
        .sort((a, b) => b.pnlUsd - a.pnlUsd)
    : [];

  const unrealized = held.reduce((s, p) => s + p.unrealizedPnlUsd, 0);
  const equity = account.balance + held.reduce((s, p) => s + p.marginUsd, 0) + unrealized;
  const activity = mine
    .filter((e) => e.kind === "fill" || e.kind === "pnl")
    .sort((a, b) => ("block" in b ? b.block : 0) - ("block" in a ? a.block : 0))
    .slice(0, 60)
    .map((e) => ({
      t: "block" in e ? store.timeOf(e.block) : 0,
      kind: e.kind,
      symbol: "perpId" in e ? (symbolOf.get(e.perpId) ?? `#${e.perpId}`) : null,
      volumeUsd: e.kind === "fill" ? e.volumeUsd : null,
      feeUsd: e.kind === "fill" ? e.feeUsd : null,
      maker: e.kind === "fill" ? e.maker : null,
      pnlUsd: e.kind === "pnl" ? e.pnlUsd : null,
      closed: e.kind === "pnl" ? e.closed : null,
      liquidated: e.kind === "pnl" ? e.liquidated : null,
    }));

  const windowHours = store.coveredHours();

  return {
    found: true as const,
    network: net,
    address,
    accountId: id,
    balanceUsd: account.balance,
    lockedUsd: account.lockedBalance,
    equityUsd: equity,
    unrealizedPnlUsd: unrealized,
    badges: { equity: equityTier(equity), pnl: pnlTier(stats?.netPnlUsd ?? 0) },
    positions: held,
    stats,
    activity,
    indexedHours: Number.isFinite(windowHours) ? windowHours : 0,
    backfilling: !store.progress.done,
    bySymbol,
  };
}
