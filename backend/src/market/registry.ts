import { fetchOfficialPrices, loadStockTokens, type OfficialQuote, type StockTokenEntry } from "shared";

// api.robinhood.com sends no CORS headers, so a browser can't call it
// directly — this proxies it for the web client. Registry data changes
// rarely (new listings, corporate actions); prices move constantly, so
// each gets its own cache lifetime.
const registryTtlMs = 15 * 60_000;
let registryCache: { at: number; tokens: StockTokenEntry[] } | null = null;

export async function registryTokens(): Promise<StockTokenEntry[]> {
  if (registryCache && Date.now() - registryCache.at < registryTtlMs) return registryCache.tokens;
  const tokens = await loadStockTokens();
  registryCache = { at: Date.now(), tokens };
  return tokens;
}

const priceTtlMs = 15_000;
const priceCache = new Map<string, { at: number; quote: OfficialQuote }>();

export async function referencePrices(symbols: string[]): Promise<Map<string, OfficialQuote>> {
  const result = new Map<string, OfficialQuote>();
  const stale: string[] = [];

  for (const symbol of symbols) {
    const hit = priceCache.get(symbol);
    if (hit && Date.now() - hit.at < priceTtlMs) result.set(symbol, hit.quote);
    else stale.push(symbol);
  }

  if (stale.length > 0) {
    const fresh = await fetchOfficialPrices(stale);
    fresh.forEach((quote, symbol) => {
      priceCache.set(symbol, { at: Date.now(), quote });
      result.set(symbol, quote);
    });
  }

  return result;
}

// Bigint fields (ERC-8056 multiplier snapshots) aren't JSON-safe — stringify
// them for the wire; the web client reconstructs the bigint on the way in.
export function serializeToken(token: StockTokenEntry) {
  return {
    ...token,
    currentMultiplierSnapshot: token.currentMultiplierSnapshot.toString(),
    pendingMultiplierSnapshot: token.pendingMultiplierSnapshot?.toString(),
  };
}
