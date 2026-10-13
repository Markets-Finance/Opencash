import { OrderType } from "../perpl/orders.js";
import type { PerpMarket } from "../perpl/markets.js";
import type { BinPosition } from "./position.js";

export type BinLegView = {
  symbol: string;
  direction: "long" | "short";
  allocationPct: number;
  units: number;
  entry: number;
  mark: number;
  margin: number;
  pnl: number;
  pnlPct: number;
};

export type BinView = { legs: BinLegView[]; margin: number; pnl: number; pnlPct: number };

export function binView(position: BinPosition, markets: Map<string, PerpMarket>): BinView {
  const margin = position.legs.reduce((sum, leg) => sum + leg.position.deposit, 0);
  const legs = position.legs.map(({ symbol, position: leg }): BinLegView => {
    const market = markets.get(symbol);
    const units = market ? leg.lots / 10 ** market.lotDecimals : 0;
    return {
      symbol,
      direction: leg.positionType === OrderType.OpenLong ? "long" : "short",
      allocationPct: margin > 0 ? (leg.deposit / margin) * 100 : 0,
      units,
      entry: leg.entryPrice,
      mark: leg.mark,
      margin: leg.deposit,
      pnl: leg.pnl,
      pnlPct: leg.deposit > 0 ? (leg.pnl / leg.deposit) * 100 : 0,
    };
  });
  const pnl = legs.reduce((sum, leg) => sum + leg.pnl, 0);
  return { legs, margin, pnl, pnlPct: margin > 0 ? (pnl / margin) * 100 : 0 };
}

export type PricePoint = { time: number; close: number };

export function binSeries(view: BinView, prices: Map<string, PricePoint[]>): { time: number; value: number }[] {
  const times = new Set<number>();
  for (const leg of view.legs) for (const point of prices.get(leg.symbol) ?? []) times.add(point.time);
  const lookups = new Map(view.legs.map((leg) => [leg.symbol, new Map((prices.get(leg.symbol) ?? []).map((point) => [point.time, point.close]))]));
  const series: { time: number; value: number }[] = [];
  for (const time of [...times].sort((a, b) => a - b)) {
    let total = 0;
    let complete = true;
    for (const leg of view.legs) {
      const price = lookups.get(leg.symbol)?.get(time);
      if (price === undefined) {
        complete = false;
        break;
      }
      total += leg.units * (price - leg.entry) * (leg.direction === "long" ? 1 : -1);
    }
    if (complete) series.push({ time, value: total });
  }
  return series;
}
