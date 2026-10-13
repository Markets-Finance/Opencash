import assert from "node:assert/strict";
import { exchangeVolumeSeries } from "./volume.js";

const candle = (time: number, volumeUsd: number) => ({ time, open: 1, high: 1, low: 1, close: 1, volumeUsd, trades: 1 });
const markets = [
  { symbol: "BTC", isOpen: true },
  { symbol: "ETH", isOpen: true },
  { symbol: "OLD", isOpen: false },
] as never;
const books: Record<string, ReturnType<typeof candle>[]> = { BTC: [candle(2, 5), candle(1, 10)], ETH: [candle(1, 4)] };
const series = await exchangeVolumeSeries({ getMarkets: async () => markets, getCandles: async (s) => ({ candles: books[s] ?? [], resolution: 3600 }) });
assert.deepEqual(series, [{ time: 1, value: 14 }, { time: 2, value: 5 }]);
console.log("volume: ok");
