import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { decodeLogs, fetchLedgerLogs, type LedgerEvent } from "shared";
import { ingest, orderEvents, type AccountAgg } from "./accounts.js";
import { contextFor, type Net } from "./context.js";

export type Bucket = {
  hour: number;
  volumeUsd: number;
  feesUsd: number;
  depositsUsd: number;
  withdrawalsUsd: number;
  liquidations: number;
  trades: number;
  accounts: number[];
  oiUsd?: number;
  tvlUsd?: number;
};

type Saved = {
  version: number;
  startBlock: number;
  lastBlock: number;
  syncedAt: number;
  headBlock: number;
  headTime: number;
  events: LedgerEvent[];
  buckets: Bucket[];
  accounts: Record<number, AccountAgg>;
};

const savedVersion = 2;
const blockSec = 0.4;
const segmentBlocks = 20_000;
const blocksPerDay = Math.round(86_400_000 / 400);

function blankSaved(): Saved {
  return { version: savedVersion, startBlock: 0, lastBlock: 0, syncedAt: 0, headBlock: 0, headTime: 0, events: [], buckets: [], accounts: {} };
}

function backfillDays(net: Net): number {
  const configured = Number(process.env.ANALYTICS_BACKFILL_DAYS);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return net === "mainnet" ? 3 : 1;
}

const hourMs = 3_600_000;
const blockMs = 400;
const retentionHours = 24;

const stores = new Map<Net, Store>();

export function storeFor(net: Net): Store {
  let store = stores.get(net);
  if (!store) {
    store = new Store(net);
    stores.set(net, store);
    store.start();
  }
  return store;
}

class Store {
  private saved: Saved = blankSaved();
  private loaded = false;
  private syncing = false;
  private readonly path: string;

  constructor(private readonly net: Net) {
    this.path = `data/analytics-${net}.json`;
  }

  start() {
    const run = () => this.sync().catch((error) => console.error(`analytics sync ${this.net} failed`, error));
    void run();
    setInterval(run, 60_000);
  }

  private async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as Saved;
      if (parsed.version === savedVersion) this.saved = parsed;
    } catch {
      return;
    }
  }

  timeOf(block: number): number {
    return this.saved.headTime - (this.saved.headBlock - block) * blockMs;
  }

  async snapshot(): Promise<Saved> {
    await this.load();
    return this.saved;
  }

  async recordSnapshot(oiUsd: number, tvlUsd: number) {
    await this.load();
    const hour = Math.floor(Date.now() / hourMs) * hourMs;
    let bucket = this.saved.buckets.find((b) => b.hour === hour);
    if (!bucket) {
      bucket = { hour, volumeUsd: 0, feesUsd: 0, depositsUsd: 0, withdrawalsUsd: 0, liquidations: 0, trades: 0, accounts: [] };
      this.saved.buckets.push(bucket);
    }
    bucket.oiUsd = oiUsd;
    bucket.tvlUsd = tvlUsd;
  }

  async sync(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    try {
      await this.load();
      const { client, deployment, api } = contextFor(this.net);
      const markets = await api.getMarkets();
      const decimals = new Map(markets.map((m) => [m.id, { price: m.priceDecimals, lot: m.sizeDecimals }]));
      const head = Number(await client.getBlockNumber());
      if (this.saved.lastBlock === 0) {
        this.saved.startBlock = head - backfillDays(this.net) * blocksPerDay;
        this.saved.lastBlock = this.saved.startBlock - 1;
      }
      let from = this.saved.lastBlock + 1;
      while (from <= head) {
        const to = Math.min(head, from + segmentBlocks - 1);
        await this.ingestRange(from, to, head, decimals);
        from = to + 1;
      }
    } finally {
      this.syncing = false;
    }
  }

  get progress(): { startBlock: number; lastBlock: number; headBlock: number; done: boolean } {
    const { startBlock, lastBlock, headBlock } = this.saved;
    return { startBlock, lastBlock, headBlock, done: headBlock - lastBlock < segmentBlocks };
  }

  private async ingestRange(from: number, to: number, head: number, decimals: Map<number, { price: number; lot: number }>) {
    const { client, deployment } = contextFor(this.net);
    const logs = await fetchLedgerLogs(client, deployment.exchange, BigInt(from), BigInt(to));
    const { events } = decodeLogs(logs as never, decimals);

    this.saved.headBlock = head;
    this.saved.headTime = Date.now();
    const buckets = new Map(this.saved.buckets.map((b) => [b.hour, b]));
    for (const event of orderEvents(events)) {
      ingest(this.saved.accounts, event, blockSec);
      if (event.kind === "account") continue;
      const hour = Math.floor(this.timeOf(event.block) / hourMs) * hourMs;
      let bucket = buckets.get(hour);
      if (!bucket) {
        bucket = { hour, volumeUsd: 0, feesUsd: 0, depositsUsd: 0, withdrawalsUsd: 0, liquidations: 0, trades: 0, accounts: [] };
        buckets.set(hour, bucket);
      }
      if (event.kind === "cash") {
        if (event.amountUsd >= 0) bucket.depositsUsd += event.amountUsd;
        else bucket.withdrawalsUsd += -event.amountUsd;
      }
      if (event.kind === "fill") {
        bucket.feesUsd += event.feeUsd;
        if (!event.maker) {
          bucket.volumeUsd += event.volumeUsd;
          bucket.trades += 1;
        }
      }
      if (event.kind === "pnl" && event.liquidated) bucket.liquidations += 1;
      if (event.accountId !== null && !bucket.accounts.includes(event.accountId)) bucket.accounts.push(event.accountId);
    }

    const keepFrom = head - Math.round((retentionHours * hourMs) / blockMs);
    const kept = this.saved.events.filter((e) => e.kind === "account" || e.block >= keepFrom);
    this.saved.events = [...kept, ...events.filter((e) => e.kind === "account" || e.block >= keepFrom)];
    this.saved.buckets = [...buckets.values()].sort((a, b) => a.hour - b.hour);
    this.saved.lastBlock = to;
    this.saved.syncedAt = Date.now();
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(this.saved));
  }
}
