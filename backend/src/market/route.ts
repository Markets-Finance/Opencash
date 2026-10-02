import type { FastifyInstance } from "fastify";
import { fetchMarketChart, type MarketChart } from "shared";
import { referencePrices, registryTokens, serializeToken } from "./registry.js";
import { tradableEntries } from "./tradable.js";

type ChartRange = "5d" | "1mo" | "3mo" | "1y";
const chartRanges: ChartRange[] = ["5d", "1mo", "3mo", "1y"];

// Yahoo's public chart endpoint is undocumented and rate-limit-unknown, and
// every browser client would otherwise hit it directly and independently —
// a short shared cache keeps repeated loads from hammering it. Keyed by
// symbol+range since each range is a separate upstream call.
const cacheTtlMs = 60_000;
const cache = new Map<string, { at: number; chart: MarketChart }>();

async function cachedChart(symbol: string, range: ChartRange = "5d"): Promise<MarketChart | null> {
  const key = `${symbol}:${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < cacheTtlMs) return hit.chart;
  const chart = await fetchMarketChart(symbol, range);
  if (chart) cache.set(key, { at: Date.now(), chart });
  return chart;
}

export function registerMarketRoute(app: FastifyInstance): void {
  app.get<{ Querystring: { symbol: string; range?: string } }>(
    "/market/chart",
    async (request, reply) => {
      const { symbol, range } = request.query;
      if (!symbol) return reply.status(400).send({ error: "symbol is required" });
      const resolvedRange = chartRanges.includes(range as ChartRange) ? (range as ChartRange) : "5d";
      const chart = await cachedChart(symbol.toUpperCase(), resolvedRange);
      if (!chart) return reply.status(404).send({ error: `No market data for ${symbol}` });
      return chart;
    },
  );

  app.get<{ Querystring: { symbols: string } }>("/market/charts", async (request, reply) => {
    const { symbols } = request.query;
    if (!symbols) return reply.status(400).send({ error: "symbols is required (comma-separated)" });
    const list = symbols.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    const charts = await Promise.all(list.map((symbol) => cachedChart(symbol)));
    const result: Record<string, MarketChart> = {};
    list.forEach((symbol, i) => {
      const chart = charts[i];
      if (chart) result[symbol] = chart;
    });
    return result;
  });

  // Every registered Stock Token that quotes within a safe distance of
  // Robinhood's reference price — see market/tradable.ts. Anything not in
  // this list has a pool but shouldn't be traded against; clients use it to
  // filter what they list, not just what they warn about after the fact.
  app.get("/market/tradable", async () => {
    const entries = await tradableEntries();
    return entries.filter((entry) => entry.safe);
  });

  // api.robinhood.com sends no CORS headers — a browser can't call it
  // directly, so both of these proxy it. registryTokens/referencePrices
  // each keep their own short cache; see market/registry.ts.
  app.get("/registry/tokens", async () => {
    const tokens = await registryTokens();
    return tokens.map(serializeToken);
  });

  app.get<{ Querystring: { symbols: string } }>("/registry/prices", async (request, reply) => {
    const { symbols } = request.query;
    if (!symbols) return reply.status(400).send({ error: "symbols is required (comma-separated)" });
    const list = symbols.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    const prices = await referencePrices(list);
    return Object.fromEntries(prices);
  });
}
