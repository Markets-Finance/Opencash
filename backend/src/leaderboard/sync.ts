import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Address } from "viem";
import {
  aggregate,
  decodeLogs,
  defaultRank,
  fetchLedgerLogs,
  rankAccounts,
  resolveAddresses,
  type AccountStats,
  type LedgerEvent,
} from "shared";
import { applyCopies } from "../strategies/apply.js";
import { api, client, deployment, network } from "./chain.js";

type Ledger = { lastBlock: number; syncedAt: number; events: LedgerEvent[] };

const windowHours = Number(process.env.LEADERBOARD_WINDOW_HOURS ?? 6);
const maxCatchUpBlocks = 40_000;
const path = `data/ledger-${network}.json`;

let ledger: Ledger | null = null;
let ranked: { stats: AccountStats[]; at: number } | null = null;
let syncing = false;

async function load(): Promise<Ledger> {
  if (ledger) return ledger;
  try {
    ledger = JSON.parse(await readFile(path, "utf8")) as Ledger;
  } catch {
    ledger = { lastBlock: 0, syncedAt: 0, events: [] };
  }
  return ledger;
}

async function save(next: Ledger) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(next));
}

export async function syncLedger(): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    const current = await load();
    const head = await client.getBlockNumber();
    const blocksPerWindow = Math.round((windowHours * 3600) / 0.4);
    const windowStart = Number(head) - blocksPerWindow;
    const from = Math.max(current.lastBlock + 1, windowStart, Number(head) - maxCatchUpBlocks);
    if (from > Number(head)) return;

    const markets = await api.getMarkets();
    const decimals = new Map(markets.map((m) => [m.id, { price: m.priceDecimals, lot: m.sizeDecimals }]));
    const logs = await fetchLedgerLogs(client, deployment.exchange, BigInt(from), head);
    const { events } = decodeLogs(logs as never, decimals);
    await applyCopies(events, Number(head), new Map(markets.map((m) => [m.symbol, m.id])));

    const kept = current.events.filter((e) => e.kind === "account" || ("block" in e && e.block >= windowStart));
    ledger = { lastBlock: Number(head), syncedAt: Date.now(), events: [...kept, ...events] };
    await save(ledger);
    ranked = null;
  } finally {
    syncing = false;
  }
}

export async function currentRanking(): Promise<{ stats: AccountStats[]; syncedAt: number; network: string; windowHours: number }> {
  const current = await load();
  if (!ranked || ranked.at !== current.syncedAt) {
    const stats0 = aggregate(current.events);
    const known = new Map<number, Address>();
    for (const e of current.events) if (e.kind === "account") known.set(e.accountId, e.address);
    const missing = stats0.filter((s) => !known.has(s.accountId)).map((s) => s.accountId);
    const resolved = await resolveAddresses(client, deployment.exchange, missing);
    resolved.forEach((address, id) => known.set(id, address));
    ranked = { stats: rankAccounts(aggregate(current.events, known), defaultRank), at: current.syncedAt };
  }
  return { stats: ranked.stats, syncedAt: current.syncedAt, network, windowHours };
}
