import type { SmartPulse } from "./types.js";

export type GateLeg = { symbol: string; direction: "long" | "short"; weightBps: number };

export type SignalGate = { ok: boolean; reason: string; backedBps: number; againstBps: number };

export const requiredBackedBps = 5000;

export function signalGate(legs: GateLeg[], pulses: SmartPulse[] | null): SignalGate {
  if (pulses === null) return { ok: false, reason: "Smart-money data is unavailable right now", backedBps: 0, againstBps: 0 };
  const bySymbol = new Map(pulses.map((pulse) => [pulse.symbol, pulse]));
  let backed = 0;
  let against = 0;
  const opposed: string[] = [];
  for (const leg of legs) {
    const pulse = bySymbol.get(leg.symbol.toUpperCase());
    if (!pulse || pulse.tokens.length === 0 || pulse.stance === "flat") continue;
    if ((pulse.stance === "buying") === (leg.direction === "long")) backed += leg.weightBps;
    else {
      against += leg.weightBps;
      opposed.push(`${leg.symbol} (smart money ${pulse.stance})`);
    }
  }
  if (against > 0) return { ok: false, reason: `Smart money is against ${opposed.join(", ")}`, backedBps: backed, againstBps: against };
  if (backed < requiredBackedBps) {
    return { ok: false, reason: `Smart money backs only ${(backed / 100).toFixed(0)}% of the weight, needs ${requiredBackedBps / 100}%`, backedBps: backed, againstBps: against };
  }
  return { ok: true, reason: `Smart money backs ${(backed / 100).toFixed(0)}% of the weight`, backedBps: backed, againstBps: against };
}
