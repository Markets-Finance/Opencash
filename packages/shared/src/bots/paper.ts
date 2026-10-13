import type { StrategyCard } from "../strategy/types.js";

export function paperPnl(card: StrategyCard, entries: Record<string, number>, prices: Record<string, number>): number {
  let total = 0;
  for (const leg of card.legs) {
    const entry = entries[leg.symbol];
    const price = prices[leg.symbol];
    if (!entry || !price) continue;
    const notional = ((card.marginUsd * leg.weightBps) / 10_000) * leg.leverage;
    total += notional * (leg.direction === "long" ? 1 : -1) * (price / entry - 1);
  }
  return total;
}

export function paperExit(card: StrategyCard, pnl: number): "stop" | "target" | null {
  const pct = (pnl / card.marginUsd) * 100;
  if (pct <= -card.stopLossPct) return "stop";
  if (card.takeProfitPct !== undefined && pct >= card.takeProfitPct) return "target";
  return null;
}
