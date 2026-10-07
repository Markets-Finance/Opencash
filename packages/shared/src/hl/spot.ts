import type { InfoClient } from "@nktkas/hyperliquid";

export type HlSpotMarket = {
  coin: string;
  pair: string;
  index: number;
  assetId: number;
  base: string;
  quote: string;
  szDecimals: number;
  markPx: number;
  prevDayPx: number;
  dayNtlVlm: number;
};

export type HlSpotBalance = {
  coin: string;
  total: number;
  hold: number;
  available: number;
};

export async function listSpotMarkets(info: InfoClient): Promise<HlSpotMarket[]> {
  const [meta, ctxs] = await info.spotMetaAndAssetCtxs();
  return meta.universe.flatMap((u, i) => {
    const base = meta.tokens.find((t) => t.index === u.tokens[0]);
    const quote = meta.tokens.find((t) => t.index === u.tokens[1]);
    const ctx = ctxs[i];
    if (!base || !quote || !ctx) return [];
    return [
      {
        coin: u.name,
        pair: `${base.name}/${quote.name}`,
        index: u.index,
        assetId: 10000 + u.index,
        base: base.name,
        quote: quote.name,
        szDecimals: base.szDecimals,
        markPx: Number(ctx.markPx),
        prevDayPx: Number(ctx.prevDayPx),
        dayNtlVlm: Number(ctx.dayNtlVlm),
      },
    ];
  });
}

export async function getSpotBalances(
  info: InfoClient,
  user: `0x${string}`,
): Promise<HlSpotBalance[]> {
  const s = await info.spotClearinghouseState({ user });
  return s.balances.map((b) => ({
    coin: b.coin,
    total: Number(b.total),
    hold: Number(b.hold),
    available: Number(b.total) - Number(b.hold),
  }));
}
