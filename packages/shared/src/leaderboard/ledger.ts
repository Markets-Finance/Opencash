import type { Address } from "viem";
import { defaultRank, type AccountStats, type LedgerEvent, type RankOptions } from "./types.js";

type Series = { block: number; logIndex: number; delta: number };

function blank(accountId: number): AccountStats {
  return {
    accountId,
    address: null,
    netPnlUsd: 0,
    grossPnlUsd: 0,
    fundingUsd: 0,
    feesUsd: 0,
    builderFeesUsd: 0,
    volumeUsd: 0,
    closedTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    profitFactor: null,
    maxDrawdownUsd: 0,
    liquidations: 0,
    netDepositsUsd: 0,
    firstBlock: Number.POSITIVE_INFINITY,
    lastBlock: 0,
  };
}

export function aggregate(events: LedgerEvent[], addresses: Map<number, Address> = new Map()): AccountStats[] {
  const stats = new Map<number, AccountStats>();
  const series = new Map<number, Series[]>();
  const grossWin = new Map<number, number>();
  const grossLoss = new Map<number, number>();

  const get = (id: number) => {
    let s = stats.get(id);
    if (!s) {
      s = blank(id);
      stats.set(id, s);
      series.set(id, []);
    }
    return s;
  };

  for (const event of events) {
    if (event.kind === "account") {
      addresses.set(event.accountId, event.address);
      continue;
    }
    if (event.accountId === null) continue;
    const s = get(event.accountId);
    const points = series.get(event.accountId)!;

    if (event.kind === "cash") {
      s.netDepositsUsd += event.amountUsd;
      s.firstBlock = Math.min(s.firstBlock, event.block);
      s.lastBlock = Math.max(s.lastBlock, event.block);
    } else if (event.kind === "pnl") {
      const total = event.pnlUsd + event.fundingUsd;
      s.grossPnlUsd += event.pnlUsd;
      s.fundingUsd += event.fundingUsd;
      if (event.liquidated) s.liquidations += 1;
      if (event.closed) {
        s.closedTrades += 1;
        if (total > 0) {
          s.wins += 1;
          grossWin.set(event.accountId, (grossWin.get(event.accountId) ?? 0) + total);
        } else if (total < 0) {
          s.losses += 1;
          grossLoss.set(event.accountId, (grossLoss.get(event.accountId) ?? 0) - total);
        }
      }
      points.push({ block: event.block, logIndex: event.logIndex, delta: total });
      s.firstBlock = Math.min(s.firstBlock, event.block);
      s.lastBlock = Math.max(s.lastBlock, event.block);
    } else {
      s.feesUsd += event.feeUsd;
      s.builderFeesUsd += event.builderFeeUsd;
      s.volumeUsd += event.volumeUsd;
      points.push({ block: event.block, logIndex: event.logIndex, delta: -event.feeUsd });
      s.firstBlock = Math.min(s.firstBlock, event.block);
      s.lastBlock = Math.max(s.lastBlock, event.block);
    }
  }

  for (const s of stats.values()) {
    s.address = addresses.get(s.accountId) ?? null;
    s.netPnlUsd = s.grossPnlUsd + s.fundingUsd - s.feesUsd;
    const decided = s.wins + s.losses;
    s.winRate = decided === 0 ? 0 : s.wins / decided;
    const loss = grossLoss.get(s.accountId) ?? 0;
    s.profitFactor = loss > 0 ? (grossWin.get(s.accountId) ?? 0) / loss : null;
    const ordered = series.get(s.accountId)!.sort((a, b) => a.block - b.block || a.logIndex - b.logIndex);
    let cumulative = 0;
    let peak = 0;
    let worst = 0;
    for (const point of ordered) {
      cumulative += point.delta;
      peak = Math.max(peak, cumulative);
      worst = Math.min(worst, cumulative - peak);
    }
    s.maxDrawdownUsd = -worst;
    if (!Number.isFinite(s.firstBlock)) s.firstBlock = 0;
  }
  return [...stats.values()];
}

export function rankAccounts(stats: AccountStats[], options: RankOptions = defaultRank): AccountStats[] {
  return stats
    .filter((s) => s.closedTrades >= options.minClosedTrades && s.volumeUsd >= options.minVolumeUsd)
    .sort((a, b) => b.netPnlUsd - a.netPnlUsd);
}
