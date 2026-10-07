import type { ApiCandle, ApiMarket, Book, FundingPoint, PerplApi, Ticker } from "../perpl/api.js";
import { snapshotMarket, type MarketSnapshot } from "../analysis/market.js";
import type { RiskLimits } from "../strategy/types.js";

const marketTtlMs = 300_000;
const tickerTtlMs = 4_000;
const fundingTtlMs = 120_000;
const fundingDays = 7;

type Cached<T> = { at: number; value: T };

export type Toolbox = ReturnType<typeof createToolbox>;

export function resolutionForDays(days: number): number {
  if (days <= 1) return 300;
  if (days <= 3) return 900;
  if (days <= 7) return 1800;
  return 7200;
}

export function createToolbox(api: PerplApi, limits: RiskLimits, now: () => number = Date.now) {
  let markets: Cached<ApiMarket[]> | null = null;
  let tickers: Cached<Map<number, Ticker>> | null = null;
  const funding = new Map<number, Cached<FundingPoint[]>>();

  async function getMarkets(): Promise<ApiMarket[]> {
    if (markets && now() - markets.at < marketTtlMs) return markets.value;
    const value = (await api.getMarkets()).filter((m) => m.isOpen);
    markets = { at: now(), value };
    return value;
  }

  async function getMarket(symbol: string): Promise<ApiMarket> {
    const found = (await getMarkets()).find((m) => m.symbol.toUpperCase() === symbol.toUpperCase());
    if (!found) throw new Error(`Unknown market ${symbol}`);
    return found;
  }

  async function getTickers(): Promise<Map<number, Ticker>> {
    if (tickers && now() - tickers.at < tickerTtlMs) return tickers.value;
    const value = await api.getTickers(await getMarkets());
    tickers = { at: now(), value };
    return value;
  }

  async function getFunding(market: ApiMarket): Promise<FundingPoint[]> {
    const cached = funding.get(market.id);
    if (cached && now() - cached.at < fundingTtlMs) return cached.value;
    const to = now();
    const value = await api.getFunding(market, to - fundingDays * 86_400_000, to);
    funding.set(market.id, { at: now(), value });
    return value;
  }

  async function getSnapshot(symbol: string): Promise<{ market: ApiMarket; snapshot: MarketSnapshot }> {
    const market = await getMarket(symbol);
    const ticker = (await getTickers()).get(market.id);
    if (!ticker) throw new Error(`No ticker for ${symbol}`);
    return { market, snapshot: snapshotMarket(market, ticker, await getFunding(market)) };
  }

  async function getCandles(symbol: string, days: number): Promise<{ candles: ApiCandle[]; resolution: number }> {
    const market = await getMarket(symbol);
    const resolution = resolutionForDays(days);
    const to = now();
    const candles = await api.getCandles(market, resolution, to - days * 86_400_000, to);
    return { candles, resolution };
  }

  async function getBook(symbol: string): Promise<Book> {
    return api.getBook(await getMarket(symbol), 100);
  }

  return { api, limits, getMarkets, getMarket, getTickers, getFunding, getSnapshot, getCandles, getBook };
}
