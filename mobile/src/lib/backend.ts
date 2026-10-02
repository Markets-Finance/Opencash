import type { Address } from "viem";
import type { MarketChart } from "shared";

// Dev-only: the backend isn't deployed anywhere yet. On the Android
// emulator this needs `adb reverse tcp:8787 tcp:8787` (same trick already
// used for Metro on 8081) so "localhost" here resolves to the host machine.
const API_BASE = "http://localhost:8787";

export type PortfolioSnapshot = {
  id: string;
  owner: Address;
  usdgBalance: number;
  positionsValue: number;
  totalValue: number;
  createdAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Fastify's JSON body parser rejects an empty body when Content-Type is
  // set to application/json (FST_ERR_CTP_EMPTY_JSON_BODY) — only send the
  // header when there's actually a body, e.g. not on bodyless POSTs.
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error ?? `Request to ${path} failed (${response.status})`);
  }
  return body as T;
}

export function fetchMarketCharts(symbols: string[]): Promise<Record<string, MarketChart>> {
  return request(`/market/charts?symbols=${symbols.join(",")}`);
}

export function snapshotPortfolio(input: {
  owner: Address;
  usdgBalance: number;
  positionsValue: number;
}): Promise<PortfolioSnapshot> {
  return request("/portfolio/snapshot", { method: "POST", body: JSON.stringify(input) });
}

export function fetchPortfolioHistory(owner: Address): Promise<PortfolioSnapshot[]> {
  return request(`/portfolio/history?owner=${owner}`);
}

export type TradableEntry = {
  symbol: string;
  price: number;
  premiumBps: number | null;
  safe: boolean;
};

// Every Stock Token whose Uniswap pool quotes within a safe distance of the
// reference price — see backend/src/market/tradable.ts.
export function fetchTradableSymbols(): Promise<TradableEntry[]> {
  return request("/market/tradable");
}
