import type { Address } from "viem";

export type MarketDecimals = { price: number; lot: number };

export type LedgerEvent =
  | { kind: "account"; accountId: number; address: Address }
  | { kind: "cash"; accountId: number; block: number; amountUsd: number }
  | {
      kind: "pnl";
      accountId: number;
      perpId: number;
      block: number;
      logIndex: number;
      pnlUsd: number;
      fundingUsd: number;
      closed: boolean;
      liquidated: boolean;
    }
  | {
      kind: "fill";
      accountId: number | null;
      perpId: number;
      block: number;
      logIndex: number;
      maker: boolean;
      volumeUsd: number;
      feeUsd: number;
      builderFeeUsd: number;
    };

export type AccountStats = {
  accountId: number;
  address: Address | null;
  netPnlUsd: number;
  grossPnlUsd: number;
  fundingUsd: number;
  feesUsd: number;
  builderFeesUsd: number;
  volumeUsd: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number | null;
  maxDrawdownUsd: number;
  liquidations: number;
  netDepositsUsd: number;
  firstBlock: number;
  lastBlock: number;
};

export type DecodeReport = {
  events: number;
  takerFills: number;
  unattributedTakerFills: number;
  unattributedFeeUsd: number;
};

export type RankOptions = { minClosedTrades: number; minVolumeUsd: number };

export const defaultRank: RankOptions = { minClosedTrades: 5, minVolumeUsd: 1000 };
