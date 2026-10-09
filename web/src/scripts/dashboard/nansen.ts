import { nansen as shared } from "shared";

const backend = import.meta.env.PUBLIC_BACKEND_URL ?? "http://localhost:8787";
const pulseTtlMs = 10 * 60_000;

export type Intel = shared.WalletIntel & { errors: string[] };
export type Status = { configured: boolean; creditCap: number; creditsUsed: number; creditsLeft: number | null; lastError: string | null };

const pulseCache = new Map<string, { at: number; value: Map<string, shared.SmartPulse> | null }>();
const intelCache = new Map<string, Intel>();

export async function nansenStatus(): Promise<Status | null> {
  try {
    const response = await fetch(`${backend}/nansen/status`);
    return response.ok ? ((await response.json()) as Status) : null;
  } catch {
    return null;
  }
}

export async function loadPulses(symbols: string[]): Promise<Map<string, shared.SmartPulse> | null> {
  const wanted = [...new Set(symbols.map((symbol) => symbol.toUpperCase()))].sort();
  const key = wanted.join(",");
  const hit = pulseCache.get(key);
  if (hit && Date.now() - hit.at < pulseTtlMs) return hit.value;
  let value: Map<string, shared.SmartPulse> | null = null;
  try {
    const response = await fetch(`${backend}/nansen/pulse?symbols=${key}`);
    if (response.ok) {
      const body = (await response.json()) as { pulses: shared.SmartPulse[] };
      value = new Map(body.pulses.map((pulse) => [pulse.symbol, pulse]));
    }
  } catch {
    value = null;
  }
  pulseCache.set(key, { at: Date.now(), value });
  return value;
}

export async function pulseList(symbols: string[]): Promise<shared.SmartPulse[] | null> {
  const map = await loadPulses(symbols);
  if (!map) return null;
  return symbols.map((symbol) => map.get(symbol.toUpperCase())).filter((pulse): pulse is shared.SmartPulse => pulse !== undefined);
}

export async function loadIntel(address: string, labels: boolean): Promise<Intel> {
  const key = `${address.toLowerCase()}:${labels ? 1 : 0}`;
  const hit = intelCache.get(key);
  if (hit) return hit;
  const response = await fetch(`${backend}/nansen/wallet?address=${encodeURIComponent(address)}${labels ? "&labels=1" : ""}`);
  const body = (await response.json()) as Intel & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Nansen ${response.status}`);
  intelCache.set(key, body);
  return body;
}

export function flowText(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? "+" : "−";
  const text = abs >= 1e6 ? `${(abs / 1e6).toFixed(2)}M` : abs >= 1e3 ? `${(abs / 1e3).toFixed(1)}K` : abs.toFixed(0);
  return `${sign}$${text}`;
}

export function stanceText(stance: shared.Stance): string {
  return stance === "buying" ? "Buying" : stance === "selling" ? "Selling" : "Flat";
}

export function binPulse(legs: { symbol: string; direction: "long" | "short"; weightBps: number }[], pulses: Map<string, shared.SmartPulse>) {
  return shared.binAgreement(legs, [...pulses.values()]);
}
