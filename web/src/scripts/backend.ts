import type { Address } from "viem";
import type { MarketChart, OfficialQuote, StockTokenEntry } from "shared";

// Dev-only: the backend isn't deployed anywhere yet. Run it locally
// (`pnpm --filter backend dev`) alongside `pnpm --filter web dev`.
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
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
    });
  } catch {
    // The browser's own error here is just "Failed to fetch" — indistinguishable
    // from a real bug unless you already know the backend is a separate
    // process. It almost always means `pnpm --filter backend dev` isn't running.
    throw new Error(
      `Can't reach the backend at ${API_BASE} — is \`pnpm --filter backend dev\` running?`,
    );
  }
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error ?? `Request to ${path} failed (${response.status})`);
  }
  return body as T;
}

// Proxied through the backend — Yahoo's chart endpoint sends no CORS
// headers, so a direct browser fetch is blocked.
export function fetchMarketCharts(symbols: string[]): Promise<Record<string, MarketChart>> {
  return request(`/market/charts?symbols=${symbols.join(",")}`);
}

export type ChartRange = "5d" | "1mo" | "3mo" | "1y";

export function fetchMarketChart(symbol: string, range: ChartRange = "5d"): Promise<MarketChart> {
  return request(`/market/chart?symbol=${symbol}&range=${range}`);
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

// api.robinhood.com sends no CORS headers, so the registry and reference
// prices are proxied through the backend too — see market/registry.ts.
// Bigint multiplier fields come back as strings over JSON; reconstruct them.
export async function fetchRegistryTokens(): Promise<StockTokenEntry[]> {
  const raw = await request<Record<string, unknown>[]>("/registry/tokens");
  return raw.map((token) => ({
    ...token,
    currentMultiplierSnapshot: BigInt(token.currentMultiplierSnapshot as string),
    pendingMultiplierSnapshot:
      token.pendingMultiplierSnapshot != null
        ? BigInt(token.pendingMultiplierSnapshot as string)
        : undefined,
  })) as StockTokenEntry[];
}

export function fetchReferencePrices(symbols: string[]): Promise<Map<string, OfficialQuote>> {
  return request<Record<string, OfficialQuote>>(`/registry/prices?symbols=${symbols.join(",")}`).then(
    (record) => new Map(Object.entries(record)),
  );
}
