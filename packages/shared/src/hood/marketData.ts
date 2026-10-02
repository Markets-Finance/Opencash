// Underlying-equity market data for a Stock Token's real-world ticker.
// Robinhood's own rhj feed (prices.ts) only has bid/ask + today's session
// stats — no % change, no multi-day history. This calls Yahoo Finance's
// public chart endpoint instead: unauthenticated, no key, but undocumented
// and could change or rate-limit without notice. Server-side callers only —
// the endpoint sends no CORS headers, so a browser fetch is blocked; the
// backend's /market/chart route proxies this for web and mobile alike.
const chartBaseUrl = "https://query1.finance.yahoo.com/v8/finance/chart";

export type MarketHistoryPoint = {
  timestamp: number;
  close: number;
};

export type MarketChart = {
  symbol: string;
  price: number;
  changePercent: number;
  volume: number;
  previousClose: number;
  points: MarketHistoryPoint[];
};

type YahooChartResponse = {
  chart?: {
    result?: {
      meta?: {
        regularMarketPrice?: number;
        regularMarketChangePercent?: number;
        regularMarketVolume?: number;
        chartPreviousClose?: number;
        previousClose?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: { close?: (number | null)[] }[];
      };
    }[];
  };
};

export async function fetchMarketChart(
  symbol: string,
  range: "5d" | "1mo" | "3mo" | "1y" = "5d",
  interval = "1d",
): Promise<MarketChart | null> {
  try {
    const response = await fetch(
      `${chartBaseUrl}/${symbol}?range=${range}&interval=${interval}`,
    );
    if (!response.ok) return null;
    const data = (await response.json()) as YahooChartResponse;
    const result = data.chart?.result?.[0];
    const meta = result?.meta;
    if (!result || !meta || meta.regularMarketPrice === undefined) return null;

    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const points: MarketHistoryPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (typeof close === "number") points.push({ timestamp: timestamps[i] * 1000, close });
    }

    return {
      symbol,
      price: meta.regularMarketPrice,
      changePercent: meta.regularMarketChangePercent ?? 0,
      volume: meta.regularMarketVolume ?? 0,
      previousClose: meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice,
      points,
    };
  } catch {
    return null;
  }
}

export async function fetchMarketCharts(
  symbols: readonly string[],
  range: "5d" | "1mo" | "3mo" | "1y" = "5d",
): Promise<Map<string, MarketChart>> {
  const result = new Map<string, MarketChart>();
  await Promise.all(
    symbols.map(async (symbol) => {
      const chart = await fetchMarketChart(symbol, range);
      if (chart) result.set(symbol, chart);
    }),
  );
  return result;
}

// % change from the first to the last point in a chart's own range window
// (e.g. "7d change" from a 5-trading-day chart) — distinct from
// changePercent, which is the single-session change Yahoo reports.
export function rangeChangePercent(points: MarketHistoryPoint[]): number {
  if (points.length < 2) return 0;
  const first = points[0].close;
  const last = points[points.length - 1].close;
  if (first === 0) return 0;
  return ((last - first) / first) * 100;
}
