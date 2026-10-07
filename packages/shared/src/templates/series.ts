import type { ApiMarket, FundingPoint, PerplApi } from "../perpl/api.js";
import type { Candle } from "../perpl/history.js";
import { clampParams } from "./registry.js";
import { simulate } from "./simulate.js";
import { defaultSimOptions, type Params, type SimOptions, type SimResult, type Template } from "./types.js";

export type Series = {
  market: ApiMarket;
  resolution: number;
  candles: Candle[];
  funding: FundingPoint[];
};

const windowMs = 30 * 86_400_000;
const ttlMs = 60_000;

export function createSeriesLoader(api: PerplApi, getMarkets: () => Promise<ApiMarket[]>) {
  const cache = new Map<string, { at: number; series: Series }>();

  return async function loadSeries(symbol: string, resolution: number): Promise<Series> {
    const key = `${symbol}:${resolution}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.series;
    const market = (await getMarkets()).find((m) => m.symbol === symbol);
    if (!market) throw new Error(`Unknown market ${symbol}`);
    const now = Date.now();
    const [raw, funding] = await Promise.all([
      api.getCandles(market, resolution, now - windowMs, now),
      api.getFunding(market, now - windowMs, now),
    ]);
    const candles = raw
      .filter((c) => c.time + resolution * 1000 <= now)
      .map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volumeUsd, trades: c.trades }));
    const series = { market, resolution, candles, funding };
    cache.set(key, { at: now, series });
    return series;
  };
}

export function simOptions(series: Series, allocationUsd: number): SimOptions {
  return {
    ...defaultSimOptions,
    allocationUsd,
    makerFeeBps: series.market.makerFeePpm / 100,
    takerFeeBps: series.market.takerFeePpm / 100,
    funding: series.funding,
  };
}

export function runTemplate(template: Template, params: Params, series: Series, allocationUsd: number): SimResult {
  return simulate(template.create(clampParams(template, params)), series.candles, simOptions(series, allocationUsd));
}
