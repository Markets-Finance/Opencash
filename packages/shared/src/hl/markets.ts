import type { InfoClient } from "@nktkas/hyperliquid";

export type HlMarket = {
  dex: string;
  name: string;
  assetIndex: number;
  assetId: number;
  szDecimals: number;
  maxLeverage: number;
  markPx: number;
  oraclePx: number;
  prevDayPx: number;
  dayNtlVlm: number;
  openInterest: number;
  funding: number;
};

export async function listDexes(info: InfoClient): Promise<string[]> {
  const dexes = await info.perpDexs();
  return dexes.flatMap((d) => (d ? [d.name] : [""]));
}

export async function listMarkets(info: InfoClient, dex = ""): Promise<HlMarket[]> {
  const dexIndex = dex ? (await listDexes(info)).indexOf(dex) : 0;
  const [meta, ctxs] = await info.metaAndAssetCtxs(dex ? { dex } : undefined);
  return meta.universe.flatMap((u, i) => {
    const c = ctxs[i];
    if (!c || u.isDelisted) return [];
    return [
      {
        dex,
        name: u.name,
        assetIndex: i,
        assetId: dex ? 100000 + dexIndex * 10000 + i : i,
        szDecimals: u.szDecimals,
        maxLeverage: u.maxLeverage,
        markPx: Number(c.markPx),
        oraclePx: Number(c.oraclePx),
        prevDayPx: Number(c.prevDayPx),
        dayNtlVlm: Number(c.dayNtlVlm),
        openInterest: Number(c.openInterest),
        funding: Number(c.funding),
      },
    ];
  });
}
