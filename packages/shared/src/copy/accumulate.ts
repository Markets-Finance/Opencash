import type { LedgerEvent } from "../leaderboard/types.js";
import type { CopyRecord } from "./types.js";

export function accumulate(copy: CopyRecord, events: LedgerEvent[], perpIds: Set<number>, headBlock: number): CopyRecord {
  if (copy.accountId === null) return copy;
  const upper = copy.stopBlock ?? headBlock;
  const next = { ...copy };
  for (const event of events) {
    if (event.kind !== "pnl" && event.kind !== "fill") continue;
    if (event.accountId !== copy.accountId || !perpIds.has(event.perpId)) continue;
    if (event.block <= copy.startBlock || event.block <= copy.countedThroughBlock || event.block > upper) continue;
    if (event.kind === "pnl") {
      const total = event.pnlUsd + event.fundingUsd;
      next.netPnlUsd += total;
      if (event.closed) {
        next.closedTrades += 1;
        if (total > 0) next.wins += 1;
      }
    } else {
      next.netPnlUsd -= event.feeUsd;
      next.feesUsd += event.feeUsd;
      next.volumeUsd += event.volumeUsd;
    }
  }
  next.countedThroughBlock = Math.max(copy.countedThroughBlock, Math.min(headBlock, upper));
  return next;
}
