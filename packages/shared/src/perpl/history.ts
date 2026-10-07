import type { PerpMarket } from "./markets.js";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trades: number;
};

export type CandleRangeKey = "1h" | "4h" | "1d" | "1w" | "1m";

export const candleRanges: Record<CandleRangeKey, { resolution: number; spanMs: number }> = {
  "1h": { resolution: 60, spanMs: 3_600_000 },
  "4h": { resolution: 300, spanMs: 14_400_000 },
  "1d": { resolution: 900, spanMs: 86_400_000 },
  "1w": { resolution: 7200, spanMs: 604_800_000 },
  "1m": { resolution: 28800, spanMs: 2_592_000_000 },
};

type RawCandle = { t: number; o: number; c: number; h: number; l: number; v: string; n: number };

export async function fetchCandles(
  apiUrl: string,
  market: PerpMarket,
  range: CandleRangeKey,
  now: number = Date.now(),
): Promise<Candle[]> {
  const { resolution, spanMs } = candleRanges[range];
  const url = `${apiUrl}/v1/market-data/${market.perpId}/candles/${resolution}/${now - spanMs}-${now}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Perpl candles ${response.status}`);
  const body = (await response.json()) as { d?: RawCandle[] };
  const scale = 10 ** market.priceDecimals;
  return (body.d ?? []).map((c) => ({
    time: c.t,
    open: c.o / scale,
    high: c.h / scale,
    low: c.l / scale,
    close: c.c / scale,
    volume: Number(c.v),
    trades: c.n,
  }));
}
