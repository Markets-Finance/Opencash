import type { BinAgreement, NetflowRow, SmartPulse, Stance } from "./types.js";

export const flatBandUsd = 25_000;

const aliases: Record<string, string[]> = {
  BTC: ["BTC", "WBTC", "CBBTC", "BTCB", "TBTC"],
  ETH: ["ETH", "WETH"],
  SOL: ["SOL", "WSOL"],
  MON: ["MON", "WMON"],
  HYPE: ["HYPE", "WHYPE"],
};

export function aliasesFor(symbol: string): string[] {
  const key = symbol.toUpperCase();
  return aliases[key] ?? [key, `W${key}`];
}

export function stanceOf(flow7dUsd: number, flow24hUsd: number): Stance {
  const lead = Math.abs(flow7dUsd) >= flatBandUsd ? flow7dUsd : Math.abs(flow24hUsd) >= flatBandUsd ? flow24hUsd : 0;
  return lead > 0 ? "buying" : lead < 0 ? "selling" : "flat";
}

export function pulseFromRows(symbols: string[], rows: NetflowRow[]): SmartPulse[] {
  return symbols.map((symbol) => {
    const names = new Set(aliasesFor(symbol));
    const matched = rows.filter((row) => names.has(row.token_symbol.toUpperCase()));
    const sum = (pick: (row: NetflowRow) => number) => matched.reduce((total, row) => total + (Number(pick(row)) || 0), 0);
    const flow7dUsd = sum((row) => row.net_flow_7d_usd);
    const flow24hUsd = sum((row) => row.net_flow_24h_usd);
    return {
      symbol: symbol.toUpperCase(),
      flow1hUsd: sum((row) => row.net_flow_1h_usd),
      flow24hUsd,
      flow7dUsd,
      flow30dUsd: sum((row) => row.net_flow_30d_usd),
      traders: sum((row) => row.trader_count),
      tokens: [...new Set(matched.map((row) => `${row.token_symbol}@${row.chain}`))],
      stance: matched.length === 0 ? "flat" : stanceOf(flow7dUsd, flow24hUsd),
    };
  });
}

export function binAgreement(
  legs: { symbol: string; direction: "long" | "short"; weightBps: number }[],
  pulses: SmartPulse[],
): BinAgreement {
  const bySymbol = new Map(pulses.map((pulse) => [pulse.symbol, pulse]));
  let agree = 0;
  let against = 0;
  let flat = 0;
  let unknown = 0;
  let netUsd = 0;
  for (const leg of legs) {
    const pulse = bySymbol.get(leg.symbol.toUpperCase());
    if (!pulse || pulse.tokens.length === 0) {
      unknown += 1;
      continue;
    }
    const sign = leg.direction === "long" ? 1 : -1;
    netUsd += sign * pulse.flow7dUsd * (leg.weightBps / 10_000);
    if (pulse.stance === "flat") flat += 1;
    else if ((pulse.stance === "buying") === (leg.direction === "long")) agree += 1;
    else against += 1;
  }
  const total = legs.length;
  const known = total - unknown;
  const label =
    known === 0
      ? "No smart-money data for these assets"
      : agree === 0 && against === 0
        ? "Smart money is neutral on these assets"
        : unknown === 0 && agree === total
        ? "Smart money backs every leg"
        : unknown === 0 && against === total
          ? "Smart money is against every leg"
          : `Smart money backs ${agree} of ${known} legs${unknown > 0 ? ` · ${unknown} without data` : ""}`;
  return { agree, against, flat, unknown, total, netUsd, label };
}
