import { tokensBySymbol, type StockTokenEntry } from "shared";
import { fetchRegistryTokens } from "./backend";

// One registry load for the whole session — used for trading fields
// (tokenAddress, decimals, ...), not logos. Logos come from shared's
// stockLogoUrl(symbol) instead, computed directly with no fetch.
//
// This goes through the backend (fetchRegistryTokens), not shared's
// loadStockTokens() directly — api.robinhood.com sends no CORS headers, so
// a browser fetch straight to it is silently blocked.
let cache: Map<string, StockTokenEntry> | null = null;
let pending: Promise<Map<string, StockTokenEntry>> | null = null;

export function loadAssetRegistry(): Promise<Map<string, StockTokenEntry>> {
  if (cache) return Promise.resolve(cache);
  pending ??= fetchRegistryTokens()
    .then(tokensBySymbol)
    .then((map) => {
      cache = map;
      return map;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}
