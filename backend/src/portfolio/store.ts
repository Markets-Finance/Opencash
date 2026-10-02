import { randomUUID } from "node:crypto";
import type { Address } from "viem";
import { JsonFileStore } from "../store/jsonFile.js";
import type { PortfolioSnapshot } from "./types.js";

const store = new JsonFileStore<PortfolioSnapshot>("data/portfolio-snapshots.json");

// Real history builds up one client-triggered snapshot at a time — there is
// no backfill and no indexer, so a fresh owner starts with an empty chart.
// This throttle keeps a snapshot-on-every-tab-load pattern from turning
// into one data point per page view.
const minIntervalMs = 15 * 60_000;

async function forOwner(owner: Address): Promise<PortfolioSnapshot[]> {
  const all = await store.all();
  return all
    .filter((snapshot) => snapshot.owner.toLowerCase() === owner.toLowerCase())
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function recordSnapshot(input: {
  owner: Address;
  usdgBalance: number;
  positionsValue: number;
}): Promise<PortfolioSnapshot> {
  const existing = await forOwner(input.owner);
  const latest = existing[existing.length - 1];
  if (latest && Date.now() - Date.parse(latest.createdAt) < minIntervalMs) {
    return latest;
  }

  const snapshot: PortfolioSnapshot = {
    id: randomUUID(),
    owner: input.owner,
    usdgBalance: input.usdgBalance,
    positionsValue: input.positionsValue,
    totalValue: input.usdgBalance + input.positionsValue,
    createdAt: new Date().toISOString(),
  };
  await store.set(snapshot.id, snapshot);
  return snapshot;
}

export function historyForOwner(owner: Address, limit = 200): Promise<PortfolioSnapshot[]> {
  return forOwner(owner).then((snapshots) => snapshots.slice(-limit));
}
