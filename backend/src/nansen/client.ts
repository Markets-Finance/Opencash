import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const base = "https://api.nansen.ai/api/v1";
const cachePath = "data/nansen-cache.json";
const creditCap = Number(process.env.NANSEN_CREDIT_CAP ?? 300);

type Entry = { at: number; ttl: number; value: unknown };

export class NansenError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const stats = { calls: 0, cached: 0, creditsUsed: 0, lastCost: 0, creditsLeft: null as number | null, lastError: null as string | null };
const inflight = new Map<string, Promise<unknown>>();
let cache: Record<string, Entry> | null = null;

export function nansenConfigured(): boolean {
  return Boolean(process.env.NANSEN_API_KEY);
}

export function nansenStatus() {
  return { configured: nansenConfigured(), creditCap, ...stats };
}

async function load(): Promise<Record<string, Entry>> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(cachePath, "utf8")) as Record<string, Entry>;
  } catch {
    cache = {};
  }
  return cache;
}

async function save() {
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(cache));
}

export type Reply<T> = { value: T; cached: boolean; credits: number; at: number };

export async function nansen<T>(path: string, body: unknown, ttlMs: number, estimate: number): Promise<Reply<T>> {
  const key = process.env.NANSEN_API_KEY;
  if (!key) throw new NansenError(503, "Set NANSEN_API_KEY in backend/.env to enable Nansen.");
  const id = `${path}:${JSON.stringify(body)}`;
  const store = await load();
  const hit = store[id];
  if (hit && Date.now() - hit.at < hit.ttl) {
    stats.cached += 1;
    return { value: hit.value as T, cached: true, credits: 0, at: hit.at };
  }
  const pending = inflight.get(id);
  if (pending) return (await pending) as Reply<T>;
  if (stats.creditsUsed + estimate > creditCap) throw new NansenError(429, `Nansen credit cap of ${creditCap} reached for this run.`);

  const run = (async (): Promise<Reply<T>> => {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: key },
      body: JSON.stringify(body),
    });
    stats.calls += 1;
    const cost = Number(response.headers.get("x-nansen-credits-cost"));
    const left = Number(response.headers.get("x-nansen-credits-remaining"));
    if (Number.isFinite(left) && response.headers.get("x-nansen-credits-remaining") !== null) stats.creditsLeft = left;
    if (!response.ok) {
      const text = (await response.text()).slice(0, 240);
      stats.lastError = `${response.status} ${path}`;
      throw new NansenError(response.status, `Nansen ${response.status}: ${text}`);
    }
    const credits = Number.isFinite(cost) && response.headers.get("x-nansen-credits-cost") !== null ? cost : estimate;
    stats.creditsUsed += credits;
    stats.lastCost = credits;
    const value = (await response.json()) as T;
    const at = Date.now();
    store[id] = { at, ttl: ttlMs, value };
    await save();
    return { value, cached: false, credits, at };
  })();
  inflight.set(id, run);
  try {
    return await run;
  } finally {
    inflight.delete(id);
  }
}
