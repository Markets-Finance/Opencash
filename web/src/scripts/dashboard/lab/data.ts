import { templates } from "shared";
import { api, toolbox } from "../agent/session";

type ApiMarket = Awaited<ReturnType<typeof toolbox.getMarkets>>[number];

export type Series = {
  market: ApiMarket;
  resolution: number;
  candles: templates.Candle[];
  funding: { timeMs: number; ratePpm: number }[];
};

const windowMs = 30 * 86_400_000;
const ttlMs = 60_000;
const cache = new Map<string, { at: number; series: Series }>();

export async function loadSeries(symbol: string, resolution: number): Promise<Series> {
  const key = `${symbol}:${resolution}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.series;
  const market = (await toolbox.getMarkets()).find((m) => m.symbol === symbol);
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
}

export function simOptions(series: Series, allocationUsd: number): templates.SimOptions {
  return {
    ...templates.defaultSimOptions,
    allocationUsd,
    makerFeeBps: series.market.makerFeePpm / 100,
    takerFeeBps: series.market.takerFeePpm / 100,
    funding: series.funding,
  };
}

export function runTemplate(template: templates.Template, params: templates.Params, series: Series, allocationUsd: number) {
  return templates.simulate(template.create(templates.clampParams(template, params)), series.candles, simOptions(series, allocationUsd));
}
