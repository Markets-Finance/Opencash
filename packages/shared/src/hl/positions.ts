import type { InfoClient } from "@nktkas/hyperliquid";

export type HlPosition = {
  dex: string;
  coin: string;
  size: number;
  entryPx: number;
  positionValue: number;
  leverage: number;
  leverageType: "cross" | "isolated";
  unrealizedPnl: number;
  marginUsed: number;
  liquidationPx: number | null;
};

export type HlAccount = {
  user: string;
  equity: number;
  notional: number;
  effectiveLeverage: number;
  withdrawable: number;
  positions: HlPosition[];
};

export async function getAccount(
  info: InfoClient,
  user: `0x${string}`,
  dex = "",
): Promise<HlAccount> {
  const s = await info.clearinghouseState(dex ? { user, dex } : { user });
  const equity = Number(s.marginSummary.accountValue);
  const notional = Number(s.marginSummary.totalNtlPos);
  return {
    user,
    equity,
    notional,
    effectiveLeverage: equity > 0 ? notional / equity : 0,
    withdrawable: Number(s.withdrawable),
    positions: s.assetPositions.map(({ position: p }) => ({
      dex,
      coin: p.coin,
      size: Number(p.szi),
      entryPx: Number(p.entryPx),
      positionValue: Number(p.positionValue),
      leverage: p.leverage.value,
      leverageType: p.leverage.type,
      unrealizedPnl: Number(p.unrealizedPnl),
      marginUsed: Number(p.marginUsed),
      liquidationPx: p.liquidationPx === null ? null : Number(p.liquidationPx),
    })),
  };
}
