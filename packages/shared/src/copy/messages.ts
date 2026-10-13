import type { StrategyCard } from "../strategy/types.js";

export function cardDigestInput(card: StrategyCard): string {
  return JSON.stringify({
    name: card.name,
    kind: card.kind,
    marginUsd: card.marginUsd,
    stopLossPct: card.stopLossPct,
    takeProfitPct: card.takeProfitPct ?? null,
    openOnStart: card.openOnStart ? true : undefined,
    legs: card.legs.map((leg) => [leg.symbol, leg.direction, leg.weightBps, leg.leverage]),
  });
}

export function publishMessage(digest: string, issuedAt: number): string {
  return `Publish this strategy on OpenCash.\nDigest: ${digest}\nIssued: ${new Date(issuedAt).toISOString()}`;
}

export function followMessage(strategyId: string, marginUsd: number, issuedAt: number): string {
  return `Follow strategy ${strategyId} on OpenCash with ${marginUsd} USD margin.\nIssued: ${new Date(issuedAt).toISOString()}`;
}

export function unfollowMessage(strategyId: string, issuedAt: number): string {
  return `Stop following strategy ${strategyId} on OpenCash.\nIssued: ${new Date(issuedAt).toISOString()}`;
}

export function issuedAtOf(message: string): number | null {
  const match = message.match(/Issued: (\S+)$/);
  const time = match ? Date.parse(match[1]) : NaN;
  return Number.isFinite(time) ? time : null;
}
