import { normalizeSymbol } from "./logos.js";

export type ApiMarket = {
  id: number;
  symbol: string;
  priceDecimals: number;
  sizeDecimals: number;
  maxLeverage: number;
  maintenanceLeverage: number;
  makerFeePpm: number;
  takerFeePpm: number;
  fundingIntervalSec: number;
  isOpen: boolean;
};

export type Ticker = {
  id: number;
  bid: number;
  ask: number;
  mid: number;
  mark: number;
  last: number;
  prevDay: number;
  volume24hUsd: number;
  openInterestUsd: number;
  atMs: number;
};

export type FundingPoint = { timeMs: number; ratePpm: number };

export type ApiCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeUsd: number;
  trades: number;
};

export type BookLevel = { price: number; size: number; orders: number };

export type Book = { bids: BookLevel[]; asks: BookLevel[]; atMs: number };

type RawContext = {
  markets: {
    id: number;
    symbol: string;
    name: string;
    funding_interval_sec: number;
    config: {
      is_open: boolean;
      price_decimals: number;
      size_decimals: number;
      initial_margin: number;
      maintenance_margin: number;
      maker_fee: number;
      taker_fee: number;
    };
  }[];
};

type RawTicker = {
  at: { t: number };
  orl: number;
  mrk: number;
  lst: number;
  mid: number;
  bid: number;
  ask: number;
  prv: number;
  dv: number;
  dva: string;
  oi: number;
};

type RawCandle = { t: number; o: number; c: number; h: number; l: number; v: string; n: number };

type RawLevel = { p: number; s: number; o: number };

const collateralScale = 1e6;

export function createPerplApi(baseUrl: string, fetcher: typeof fetch = fetch) {
  async function get<T>(path: string): Promise<T> {
    const response = await fetcher(`${baseUrl}${path}`);
    if (!response.ok) throw new Error(`Perpl API ${response.status} ${path}`);
    return (await response.json()) as T;
  }

  async function getMarkets(): Promise<ApiMarket[]> {
    const context = await get<RawContext>("/v1/pub/context");
    return context.markets.map((m) => ({
      id: m.id,
      symbol: normalizeSymbol(m.symbol || m.name.replace(/ Perp$/, "")),
      priceDecimals: m.config.price_decimals,
      sizeDecimals: m.config.size_decimals,
      maxLeverage: m.config.initial_margin / 100,
      maintenanceLeverage: m.config.maintenance_margin / 100,
      makerFeePpm: m.config.maker_fee,
      takerFeePpm: m.config.taker_fee,
      fundingIntervalSec: m.funding_interval_sec,
      isOpen: m.config.is_open,
    }));
  }

  async function getTickers(markets: ApiMarket[]): Promise<Map<number, Ticker>> {
    const body = await get<{ d: Record<string, RawTicker> }>("/v1/market-data/ticker");
    const tickers = new Map<number, Ticker>();
    for (const market of markets) {
      const raw = body.d[String(market.id)];
      if (!raw) continue;
      const price = 10 ** market.priceDecimals;
      const size = 10 ** market.sizeDecimals;
      tickers.set(market.id, {
        id: market.id,
        bid: raw.bid / price,
        ask: raw.ask / price,
        mid: raw.mid / price,
        mark: raw.mrk / price,
        last: raw.lst / price,
        prevDay: raw.prv / price,
        volume24hUsd: Number(raw.dva) / collateralScale,
        openInterestUsd: (raw.oi / size) * (raw.mrk / price),
        atMs: raw.at.t,
      });
    }
    return tickers;
  }

  async function getFunding(market: ApiMarket, fromMs: number, toMs: number): Promise<FundingPoint[]> {
    const body = await get<{ d: { at: { t: number }; rate: number }[] }>(
      `/v1/market-data/${market.id}/funding/${fromMs}-${toMs}`,
    );
    return body.d.map((event) => ({ timeMs: event.at.t, ratePpm: event.rate }));
  }

  async function getCandles(
    market: ApiMarket,
    resolution: number,
    fromMs: number,
    toMs: number,
  ): Promise<ApiCandle[]> {
    const body = await get<{ d: RawCandle[] }>(
      `/v1/market-data/${market.id}/candles/${resolution}/${fromMs}-${toMs}`,
    );
    const price = 10 ** market.priceDecimals;
    return body.d.map((c) => ({
      time: c.t,
      open: c.o / price,
      high: c.h / price,
      low: c.l / price,
      close: c.c / price,
      volumeUsd: Number(c.v) / collateralScale,
      trades: c.n,
    }));
  }

  async function getBook(market: ApiMarket, levels = 100): Promise<Book> {
    const body = await get<{ at: { t: number }; bid: RawLevel[]; ask: RawLevel[] }>(
      `/v1/market-data/${market.id}/book?levels=${levels}`,
    );
    const price = 10 ** market.priceDecimals;
    const size = 10 ** market.sizeDecimals;
    const convert = (level: RawLevel): BookLevel => ({
      price: level.p / price,
      size: level.s / size,
      orders: level.o,
    });
    return { bids: body.bid.map(convert), asks: body.ask.map(convert), atMs: body.at.t };
  }

  return { getMarkets, getTickers, getFunding, getCandles, getBook };
}

export type PerplApi = ReturnType<typeof createPerplApi>;
