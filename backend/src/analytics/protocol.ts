import { erc20Abi, formatUnits, type Address } from "viem";
import { fundingAprPct, resolveAddresses } from "shared";
import { contextFor, type Net } from "./context.js";
import { storeFor } from "./store.js";

const dayMs = 86_400_000;

type Cached<T> = { at: number; value: T };
const candleCache = new Map<Net, Cached<Map<string, { t: number; v: number }[]>>>();
const fundingCache = new Map<Net, Cached<Map<string, number>>>();
const viewCache = new Map<Net, Cached<unknown>>();
let accountCount = new Map<Net, Cached<number>>();

async function fresh<T>(cache: Map<Net, Cached<T>>, net: Net, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(net);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const value = await load();
  cache.set(net, { at: Date.now(), value });
  return value;
}

async function countAccounts(net: Net): Promise<number> {
  const hit = accountCount.get(net);
  if (hit && Date.now() - hit.at < 600_000) return hit.value;
  const { client, deployment } = contextFor(net);
  const exists = async (id: number) => (await resolveAddresses(client, deployment.exchange, [id])).has(id);
  let low = 1;
  let high = 2;
  while (await exists(high)) {
    low = high;
    high *= 2;
    if (high > 1 << 24) break;
  }
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (await exists(mid)) low = mid;
    else high = mid;
  }
  accountCount.set(net, { at: Date.now(), value: low });
  return low;
}

export type MarketRow = {
  symbol: string;
  name: string;
  mark: number;
  changePct: number;
  volume24h: number;
  volume7d: number;
  volume30d: number;
  volumeAll: number;
  openInterest: number;
  fundingApr: number | null;
  spreadBps: number;
  maxLeverage: number;
  shareVolume: number;
};

export async function protocolView(net: Net) {
  return fresh(viewCache as Map<Net, Cached<Awaited<ReturnType<typeof build>>>>, net, 45_000, () => build(net));
}

async function build(net: Net) {
  const { client, deployment, api } = contextFor(net);
  const store = storeFor(net);
  const now = Date.now();
  const markets = (await api.getMarkets()).filter((m) => m.isOpen);
  const tickers = await api.getTickers(markets);

  const daily = await fresh(candleCache, net, 600_000, async () => {
    const out = new Map<string, { t: number; v: number }[]>();
    await Promise.all(
      markets.map(async (market) => {
        const candles = await api.getCandles(market, 86_400, now - 400 * dayMs, now).catch(() => []);
        out.set(market.symbol, candles.map((c) => ({ t: c.time, v: c.volumeUsd })));
      }),
    );
    return out;
  });

  const funding = await fresh(fundingCache, net, 300_000, async () => {
    const out = new Map<string, number>();
    await Promise.all(
      markets.map(async (market) => {
        const points = await api.getFunding(market, now - 2 * dayMs, now).catch(() => []);
        const last = points[points.length - 1];
        if (last) out.set(market.symbol, fundingAprPct(last.ratePpm, market.fundingIntervalSec));
      }),
    );
    return out;
  });

  const sum = (series: { t: number; v: number }[], days: number) => series.filter((p) => p.t >= now - days * dayMs).reduce((s, p) => s + p.v, 0);

  const rows: MarketRow[] = markets
    .map((market) => {
      const ticker = tickers.get(market.id);
      const series = daily.get(market.symbol) ?? [];
      return {
        symbol: market.symbol,
        name: `${market.symbol} Perp`,
        mark: ticker?.mark ?? 0,
        changePct: ticker && ticker.prevDay > 0 ? ((ticker.mark - ticker.prevDay) / ticker.prevDay) * 100 : 0,
        volume24h: ticker?.volume24hUsd ?? 0,
        volume7d: sum(series, 7),
        volume30d: sum(series, 30),
        volumeAll: series.reduce((s, p) => s + p.v, 0),
        openInterest: ticker?.openInterestUsd ?? 0,
        fundingApr: funding.get(market.symbol) ?? null,
        spreadBps: ticker && ticker.mid > 0 ? ((ticker.ask - ticker.bid) / ticker.mid) * 1e4 : 0,
        maxLeverage: market.maxLeverage,
        shareVolume: 0,
      };
    })
    .sort((a, b) => b.volume24h - a.volume24h);
  const totalVolume24h = rows.reduce((s, r) => s + r.volume24h, 0);
  rows.forEach((r) => (r.shareVolume = totalVolume24h > 0 ? r.volume24h / totalVolume24h : 0));

  const byDay = new Map<number, number>();
  for (const series of daily.values()) for (const p of series) byDay.set(p.t, (byDay.get(p.t) ?? 0) + p.v);
  const volumeDaily = [...byDay.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ t, v }));

  const tvlRaw = await client.readContract({ address: deployment.collateral as Address, abi: erc20Abi, functionName: "balanceOf", args: [deployment.exchange as Address] });
  const tvl = Number(formatUnits(tvlRaw, deployment.collateralDecimals));
  const openInterest = rows.reduce((s, r) => s + r.openInterest, 0);
  await store.recordSnapshot(openInterest, tvl);

  const saved = await store.snapshot();
  const since = now - dayMs;
  const recent = saved.buckets.filter((b) => b.hour + 3_600_000 > since);
  const active = new Set<number>();
  for (const b of recent) for (const id of b.accounts) active.add(id);
  const accounts = await countAccounts(net).catch(() => null);

  const fees = recent.reduce((s, b) => s + b.feesUsd, 0);
  const eventVolume = recent.reduce((s, b) => s + b.volumeUsd, 0);

  return {
    network: net,
    at: now,
    syncedAt: saved.syncedAt,
    headline: {
      volume24h: totalVolume24h,
      volume7d: rows.reduce((s, r) => s + r.volume7d, 0),
      volume30d: rows.reduce((s, r) => s + r.volume30d, 0),
      volumeAll: rows.reduce((s, r) => s + r.volumeAll, 0),
      openInterest,
      tvl,
      accounts,
      activeAccounts: active.size,
      markets: rows.length,
    },
    window: {
      hours: recent.length > 0 && saved.syncedAt > 0 ? Math.min(24, Math.round(((saved.syncedAt - recent[0]!.hour) / 3_600_000) * 10) / 10) : 0,
      volumeUsd: eventVolume,
      feesUsd: fees,
      feeRateBps: eventVolume > 0 ? (fees / eventVolume) * 1e4 : null,
      depositsUsd: recent.reduce((s, b) => s + b.depositsUsd, 0),
      withdrawalsUsd: recent.reduce((s, b) => s + b.withdrawalsUsd, 0),
      liquidations: recent.reduce((s, b) => s + b.liquidations, 0),
      trades: recent.reduce((s, b) => s + b.trades, 0),
    },
    markets: rows,
    series: {
      volumeDaily,
      hourly: saved.buckets.slice(-48).map((b) => ({ t: b.hour, volume: b.volumeUsd, deposits: b.depositsUsd, withdrawals: b.withdrawalsUsd, liquidations: b.liquidations, oi: b.oiUsd ?? null, tvl: b.tvlUsd ?? null })),
    },
  };
}
