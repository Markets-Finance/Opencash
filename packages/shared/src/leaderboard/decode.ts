import type { Address } from "viem";
import type { DecodeReport, LedgerEvent, MarketDecimals } from "./types.js";

type Log = {
  eventName?: string;
  args?: Record<string, unknown>;
  blockNumber: bigint | null;
  logIndex: number | null;
  transactionHash: string | null;
};

type Claim = { index: number; accountId: number; perpId: number; lot: number | null; claimed: boolean };

const cns = 1e6;

const pnlEvents = new Set([
  "PositionDecreased",
  "PositionClosed",
  "PositionInverted",
  "PositionLiquidated",
  "PositionDeleveraged",
  "PositionDeleveragedV2",
]);

function num(value: unknown): number {
  return Number(value as bigint);
}

function usd(value: unknown): number {
  return num(value) / cns;
}

export function decodeLogs(
  logs: Log[],
  decimals: Map<number, MarketDecimals>,
): { events: LedgerEvent[]; report: DecodeReport } {
  const events: LedgerEvent[] = [];
  const byTx = new Map<string, Log[]>();
  for (const log of logs) {
    const key = log.transactionHash ?? "";
    const group = byTx.get(key);
    if (group) group.push(log);
    else byTx.set(key, [log]);
  }

  const report: DecodeReport = { events: 0, takerFills: 0, unattributedTakerFills: 0, unattributedFeeUsd: 0 };

  for (const group of byTx.values()) {
    group.sort((a, b) => (a.logIndex ?? 0) - (b.logIndex ?? 0));
    const claims: Claim[] = [];

    for (const log of group) {
      const a = log.args ?? {};
      const block = Number(log.blockNumber ?? 0);
      const index = log.logIndex ?? 0;
      const name = log.eventName ?? "";

      if (name === "AccountCreated") {
        events.push({ kind: "account", accountId: num(a.id), address: a.account as Address });
      } else if (name === "CollateralDeposit" || name === "CollateralWithdrawal") {
        const sign = name === "CollateralDeposit" ? 1 : -1;
        events.push({ kind: "cash", accountId: num(a.accountId), block, amountUsd: sign * usd(a.amountCNS) });
      } else if (name === "PositionOpened" || name === "PositionOpenedV2") {
        claims.push({ index, accountId: num(a.accountId), perpId: num(a.perpId), lot: num(a.lotLNS), claimed: false });
      } else if (name === "PositionIncreased" || name === "PositionIncreasedV2") {
        claims.push({
          index,
          accountId: num(a.accountId),
          perpId: num(a.perpId),
          lot: num(a.endLotLNS) - num(a.startLotLNS),
          claimed: false,
        });
      } else if (pnlEvents.has(name)) {
        const accountId = num(a.accountId ?? a.posAccountId);
        const perpId = num(a.perpId);
        const liquidated = name === "PositionLiquidated";
        events.push({
          kind: "pnl",
          accountId,
          perpId,
          block,
          logIndex: index,
          pnlUsd: usd(a.deltaPnlCNS),
          fundingUsd: usd(a.fundingCNS),
          closed: name !== "PositionDecreased",
          liquidated,
        });
        if (!liquidated) {
          const lot = name === "PositionDecreased" ? num(a.startLotLNS) - num(a.endLotLNS) : null;
          claims.push({ index, accountId, perpId, lot, claimed: false });
        }
      } else if (name === "PositionInverted") {
        claims.push({ index, accountId: num(a.accountId), perpId: num(a.perpId), lot: null, claimed: false });
      }
    }

    for (const log of group) {
      const a = log.args ?? {};
      const block = Number(log.blockNumber ?? 0);
      const index = log.logIndex ?? 0;
      const name = log.eventName ?? "";
      if (name === "MakerOrderFilledV2") {
        const dec = decimals.get(num(a.perpId));
        const price = dec ? num(a.pricePNS) / 10 ** dec.price : 0;
        const lots = dec ? num(a.lotLNS) / 10 ** dec.lot : 0;
        events.push({
          kind: "fill",
          accountId: num(a.accountId),
          perpId: num(a.perpId),
          block,
          logIndex: index,
          maker: true,
          volumeUsd: price * lots,
          feeUsd: usd(a.feeCNS),
          builderFeeUsd: usd(a.builderFeeCNS),
        });
      } else if (name === "TakerOrderFilledV2") {
        report.takerFills += 1;
        const lot = num(a.lotLNS);
        const candidates = claims.filter((c) => c.index < index && !c.claimed);
        const claim =
          [...candidates].reverse().find((c) => c.lot === lot) ?? [...candidates].reverse().find((c) => c.lot === null);
        const fee = usd(a.feeCNS);
        if (!claim) {
          report.unattributedTakerFills += 1;
          report.unattributedFeeUsd += fee;
          continue;
        }
        claim.claimed = true;
        const dec = decimals.get(claim.perpId);
        const price = dec ? num(a.entryPricePNS) / 10 ** dec.price : 0;
        const lots = dec ? lot / 10 ** dec.lot : 0;
        events.push({
          kind: "fill",
          accountId: claim.accountId,
          perpId: claim.perpId,
          block,
          logIndex: index,
          maker: false,
          volumeUsd: price * lots,
          feeUsd: fee,
          builderFeeUsd: usd(a.builderFeeCNS),
        });
      }
    }
  }

  report.events = events.length;
  return { events, report };
}
