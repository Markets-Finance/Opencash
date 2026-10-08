import type { PerpMarket } from "../perpl/markets.js";
import type { Bin, BinSizingIssue, SizedBin, SizedLeg } from "./types.js";

export const totalWeightBps = 10000;

export function validateBin(bin: Bin): void {
  const total = bin.legs.reduce((sum, leg) => sum + leg.weightBps, 0);
  if (total !== totalWeightBps) {
    throw new Error(
      `Bin ${bin.id} weights sum to ${total}, expected ${totalWeightBps}`,
    );
  }
}

export function sizeBin(
  bin: Bin,
  margin: number,
  markets: Map<string, PerpMarket>,
  maxLeverageBySymbol: Map<string, number>,
  depthCapUsd: Map<string, number> = new Map(),
): { sized: SizedBin; issues: BinSizingIssue[] } {
  validateBin(bin);

  const issues: BinSizingIssue[] = [];
  const legs: SizedLeg[] = [];

  for (const leg of bin.legs) {
    const market = markets.get(leg.symbol);
    if (!market) {
      issues.push({
        symbol: leg.symbol,
        reason: "unknown-market",
        detail: `${leg.symbol} is not listed on this deployment`,
      });
      continue;
    }

    if (market.numOrders === 0) {
      issues.push({
        symbol: leg.symbol,
        reason: "no-liquidity",
        detail: `${leg.symbol} has no resting orders`,
      });
      continue;
    }

    const cap = maxLeverageBySymbol.get(leg.symbol) ?? leg.leverage;
    const leverage = Math.min(leg.leverage, cap);
    if (leverage < leg.leverage) {
      issues.push({
        symbol: leg.symbol,
        reason: "leverage-capped",
        detail: `${leg.symbol} capped from ${leg.leverage}x to ${leverage}x`,
      });
    }

    const legMargin = (margin * leg.weightBps) / totalWeightBps;
    const lotUnit = 10 ** market.lotDecimals;
    let units = Math.floor(((legMargin * leverage) / market.mark) * lotUnit);
    const depthCap = depthCapUsd.get(leg.symbol);
    if (depthCap !== undefined && (units / lotUnit) * market.mark > depthCap) {
      units = Math.floor((depthCap / market.mark) * lotUnit);
      issues.push({
        symbol: leg.symbol,
        reason: "depth-limited",
        detail: `${leg.symbol} limited to $${depthCap.toFixed(0)} by book depth`,
      });
    }
    const lots = units / lotUnit;

    if (units <= 0) {
      issues.push({
        symbol: leg.symbol,
        reason: "below-minimum",
        detail: `$${legMargin.toFixed(2)} at ${leverage}x is under one lot of ${leg.symbol}`,
      });
      continue;
    }

    legs.push({
      leg,
      perpId: market.perpId,
      margin: Math.min(legMargin, (lots * market.mark) / leverage),
      notional: lots * market.mark,
      lots,
      mark: market.mark,
      leverage,
    });
  }

  return {
    sized: {
      bin,
      legs,
      margin: legs.reduce((sum, leg) => sum + leg.margin, 0),
      notional: legs.reduce((sum, leg) => sum + leg.notional, 0),
    },
    issues,
  };
}
