import { addressBook } from "./addresses.js";
import { type Net } from "./context.js";
import { heldPositions, marketBook, type HeldPosition } from "./positions.js";
import { storeFor } from "./store.js";

const liquidationLimit = 30;
const scanLimit = 40;
const scanChunk = 8;
const positionsTtlMs = 60_000;
const liquidationsTtlMs = 20_000;
const dustUsd = 500;

type Cached<T> = { at: number; value: T };
const positionCache = new Map<Net, Cached<Awaited<ReturnType<typeof scanPositions>>>>();
const liquidationCache = new Map<Net, Cached<Awaited<ReturnType<typeof scanLiquidations>>>>();
const pending = new Map<string, Promise<unknown>>();

async function cached<T>(cache: Map<Net, Cached<T>>, net: Net, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(net);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const key = `${net}:${ttl}`;
  const running = pending.get(key) as Promise<T> | undefined;
  if (running) return running;
  const run = load()
    .then((value) => {
      cache.set(net, { at: Date.now(), value });
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, run);
  return run;
}

async function scanLiquidations(net: Net) {
  const store = storeFor(net);
  const saved = await store.snapshot();
  const book = await marketBook(net);
  const symbolOf = new Map(book.markets.map((market) => [market.perpId, market.symbol]));
  const events = saved.events
    .filter((event) => event.kind === "pnl" && event.liquidated)
    .sort((a, b) => ("block" in b ? b.block : 0) - ("block" in a ? a.block : 0));
  const recent = events.slice(0, liquidationLimit);
  const addresses = await addressBook(net, recent.flatMap((event) => (event.kind === "pnl" ? [event.accountId] : [])));
  const lossUsd = events.reduce((sum, event) => sum + (event.kind === "pnl" ? Math.min(0, event.pnlUsd + event.fundingUsd) : 0), 0);
  const hours = saved.buckets.slice(-48).map((bucket) => ({ t: bucket.hour, count: bucket.liquidations }));
  return {
    network: net,
    at: Date.now(),
    count: events.length,
    lossUsd: -lossUsd,
    hours,
    recent: recent.flatMap((event) =>
      event.kind === "pnl"
        ? [
            {
              t: store.timeOf(event.block),
              symbol: symbolOf.get(event.perpId) ?? `#${event.perpId}`,
              accountId: event.accountId,
              address: addresses.get(event.accountId) ?? null,
              lossUsd: -Math.min(0, event.pnlUsd + event.fundingUsd),
            },
          ]
        : [],
    ),
  };
}

async function scanPositions(net: Net) {
  const saved = await storeFor(net).snapshot();
  const ranked = Object.entries(saved.accounts)
    .map(([id, agg]) => ({ id: Number(id), volume: agg.volumeUsd }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, scanLimit);
  const addresses = await addressBook(net, ranked.map((row) => row.id));
  const rows: (HeldPosition & { accountId: number; address: string | null })[] = [];
  for (let start = 0; start < ranked.length; start += scanChunk) {
    const chunk = ranked.slice(start, start + scanChunk);
    const held = await Promise.all(chunk.map((row) => heldPositions(net, BigInt(row.id)).catch(() => [] as HeldPosition[])));
    held.forEach((positions, index) => {
      for (const position of positions) rows.push({ ...position, accountId: chunk[index].id, address: addresses.get(chunk[index].id) ?? null });
    });
  }
  const largest = [...rows].sort((a, b) => b.notionalUsd - a.notionalUsd).slice(0, 25);
  const nearest = rows
    .filter((row) => row.notionalUsd >= dustUsd && row.liquidationDistancePct !== null)
    .sort((a, b) => a.liquidationDistancePct! - b.liquidationDistancePct!)
    .slice(0, 15);
  return {
    network: net,
    at: Date.now(),
    scanned: ranked.length,
    openPositions: rows.length,
    openNotionalUsd: rows.reduce((sum, row) => sum + row.notionalUsd, 0),
    largest,
    nearest,
  };
}

export const liquidationsView = (net: Net) => cached(liquidationCache, net, liquidationsTtlMs, () => scanLiquidations(net));
export const positionsView = (net: Net) => cached(positionCache, net, positionsTtlMs, () => scanPositions(net));
