import { priceStats, summarizeDepth } from "../analysis/market.js";
import type { ApiCandle, Book } from "../perpl/api.js";
import type { LegInputs } from "./weights.js";

export type BinInputSource = {
  getBook(symbol: string): Promise<Book>;
  getCandles(symbol: string, days: number): Promise<{ candles: ApiCandle[]; resolution: number }>;
};

export async function loadBinInputs(source: BinInputSource, symbols: string[]): Promise<Map<string, LegInputs>> {
  const entries = await Promise.all(
    [...new Set(symbols)].map(async (symbol): Promise<[string, LegInputs]> => {
      const [book, series] = await Promise.all([
        source.getBook(symbol).catch(() => null),
        source.getCandles(symbol, 30).catch(() => null),
      ]);
      const input: LegInputs = {};
      if (book && book.bids[0] && book.asks[0]) {
        const depth = summarizeDepth(book, (book.bids[0].price + book.asks[0].price) / 2);
        input.depthUsd = Math.min(depth.bidUsdWithin25Bps, depth.askUsdWithin25Bps);
      }
      if (series && series.candles.length > 2) {
        input.volPct = priceStats(series.candles, series.resolution).annualizedVolPct;
      }
      return [symbol, input];
    }),
  );
  return new Map(entries);
}
