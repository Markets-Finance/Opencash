import type { ApiCandle, ApiMarket } from "./api.js";

export type VolumePoint = { time: number; value: number };

type VolumeSource = {
  getMarkets(): Promise<ApiMarket[]>;
  getCandles(symbol: string, days: number): Promise<{ candles: ApiCandle[]; resolution: number }>;
};

export async function exchangeVolumeSeries(source: VolumeSource, days = 7): Promise<VolumePoint[]> {
  const markets = (await source.getMarkets()).filter((market) => market.isOpen);
  const sets = await Promise.all(markets.map((market) => source.getCandles(market.symbol, days).then((r) => r.candles).catch(() => [] as ApiCandle[])));
  const buckets = new Map<number, number>();
  for (const candles of sets) for (const candle of candles) buckets.set(candle.time, (buckets.get(candle.time) ?? 0) + candle.volumeUsd);
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([time, value]) => ({ time, value }));
}
