import { loadStockTokens, tokensBySymbol, type StockTokenEntry } from "shared";

// One registry load for the whole app session — used for trading fields
// (tokenAddress, decimals, ...), not logos. Logos come from
// shared's stockLogoUrl(symbol) instead, computed directly with no fetch.
let cache: Map<string, StockTokenEntry> = new Map();
let loaded = false;
let pending: Promise<void> | null = null;

export function loadAssetRegistry(): Promise<Map<string, StockTokenEntry>> {
  if (loaded) return Promise.resolve(cache);
  pending ??= loadStockTokens()
    .then((list) => {
      cache = tokensBySymbol(list);
      loaded = true;
    })
    .finally(() => {
      pending = null;
    });
  return pending.then(() => cache);
}

void loadAssetRegistry();
