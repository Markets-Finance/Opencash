import type { LedgerEvent } from "shared";

export type PerpTally = { pnlUsd: number; closes: number; wins: number };

export type AccountAgg = {
  fills: number;
  volumeUsd: number;
  feesUsd: number;
  builderFeesUsd: number;
  grossPnlUsd: number;
  fundingUsd: number;
  closes: number;
  wins: number;
  losses: number;
  grossWinUsd: number;
  grossLossUsd: number;
  liquidations: number;
  netDepositsUsd: number;
  cumUsd: number;
  peakUsd: number;
  maxDrawdownUsd: number;
  streak: number;
  bestWinStreak: number;
  worstLossStreak: number;
  bestTradeUsd: number;
  worstTradeUsd: number;
  holdSecTotal: number;
  holds: number;
  byPerp: Record<string, PerpTally>;
  opened: Record<string, number>;
  closedAt: Record<string, number>;
  firstBlock: number;
  lastBlock: number;
};

export function blankAgg(): AccountAgg {
  return {
    fills: 0,
    volumeUsd: 0,
    feesUsd: 0,
    builderFeesUsd: 0,
    grossPnlUsd: 0,
    fundingUsd: 0,
    closes: 0,
    wins: 0,
    losses: 0,
    grossWinUsd: 0,
    grossLossUsd: 0,
    liquidations: 0,
    netDepositsUsd: 0,
    cumUsd: 0,
    peakUsd: 0,
    maxDrawdownUsd: 0,
    streak: 0,
    bestWinStreak: 0,
    worstLossStreak: 0,
    bestTradeUsd: 0,
    worstTradeUsd: 0,
    holdSecTotal: 0,
    holds: 0,
    byPerp: {},
    opened: {},
    closedAt: {},
    firstBlock: 0,
    lastBlock: 0,
  };
}

function touch(agg: AccountAgg, block: number) {
  if (agg.firstBlock === 0 || block < agg.firstBlock) agg.firstBlock = block;
  if (block > agg.lastBlock) agg.lastBlock = block;
}

function move(agg: AccountAgg, delta: number) {
  agg.cumUsd += delta;
  agg.peakUsd = Math.max(agg.peakUsd, agg.cumUsd);
  agg.maxDrawdownUsd = Math.max(agg.maxDrawdownUsd, agg.peakUsd - agg.cumUsd);
}

export function ingest(accounts: Record<number, AccountAgg>, event: LedgerEvent, blockSec: number) {
  if (event.kind === "account" || event.accountId === null) return;
  const agg = (accounts[event.accountId] ??= blankAgg());

  if (event.kind === "cash") {
    agg.netDepositsUsd += event.amountUsd;
    touch(agg, event.block);
    return;
  }

  if (event.kind === "fill") {
    agg.fills += 1;
    agg.volumeUsd += event.volumeUsd;
    agg.feesUsd += event.feeUsd;
    agg.builderFeesUsd += event.builderFeeUsd;
    move(agg, -event.feeUsd);
    const key = String(event.perpId);
    if (agg.opened[key] === undefined && agg.closedAt[key] !== event.block) agg.opened[key] = event.block;
    touch(agg, event.block);
    return;
  }

  const total = event.pnlUsd + event.fundingUsd;
  agg.grossPnlUsd += event.pnlUsd;
  agg.fundingUsd += event.fundingUsd;
  if (event.liquidated) agg.liquidations += 1;
  move(agg, total);
  touch(agg, event.block);
  if (!event.closed) return;

  const key = String(event.perpId);
  agg.closes += 1;
  const tally = (agg.byPerp[key] ??= { pnlUsd: 0, closes: 0, wins: 0 });
  tally.pnlUsd += total;
  tally.closes += 1;
  if (total > 0) {
    agg.wins += 1;
    agg.grossWinUsd += total;
    tally.wins += 1;
    agg.streak = agg.streak > 0 ? agg.streak + 1 : 1;
    agg.bestWinStreak = Math.max(agg.bestWinStreak, agg.streak);
  } else if (total < 0) {
    agg.losses += 1;
    agg.grossLossUsd += -total;
    agg.streak = agg.streak < 0 ? agg.streak - 1 : -1;
    agg.worstLossStreak = Math.max(agg.worstLossStreak, -agg.streak);
  }
  agg.bestTradeUsd = Math.max(agg.bestTradeUsd, total);
  agg.worstTradeUsd = Math.min(agg.worstTradeUsd, total);
  const openedAt = agg.opened[key];
  if (openedAt !== undefined && event.block >= openedAt) {
    agg.holdSecTotal += (event.block - openedAt) * blockSec;
    agg.holds += 1;
  }
  delete agg.opened[key];
  agg.closedAt[key] = event.block;
}

export function orderEvents(events: LedgerEvent[]): LedgerEvent[] {
  const at = (event: LedgerEvent) => ("block" in event ? event.block : 0);
  const index = (event: LedgerEvent) => ("logIndex" in event ? event.logIndex : 0);
  return [...events].sort((a, b) => at(a) - at(b) || index(a) - index(b));
}

export function summarise(agg: AccountAgg) {
  const decided = agg.wins + agg.losses;
  return {
    netPnlUsd: agg.grossPnlUsd + agg.fundingUsd - agg.feesUsd,
    grossPnlUsd: agg.grossPnlUsd,
    fundingUsd: agg.fundingUsd,
    feesUsd: agg.feesUsd,
    builderFeesUsd: agg.builderFeesUsd,
    volumeUsd: agg.volumeUsd,
    closedTrades: agg.closes,
    wins: agg.wins,
    losses: agg.losses,
    winRate: decided === 0 ? 0 : agg.wins / decided,
    profitFactor: agg.grossLossUsd > 0 ? agg.grossWinUsd / agg.grossLossUsd : null,
    maxDrawdownUsd: agg.maxDrawdownUsd,
    liquidations: agg.liquidations,
    netDepositsUsd: agg.netDepositsUsd,
    firstBlock: agg.firstBlock,
    lastBlock: agg.lastBlock,
    streak: agg.streak,
    bestWinStreak: agg.bestWinStreak,
    worstLossStreak: agg.worstLossStreak,
    bestTradeUsd: agg.bestTradeUsd,
    worstTradeUsd: agg.worstTradeUsd,
    avgHoldSec: agg.holds > 0 ? agg.holdSecTotal / agg.holds : null,
  };
}
