import {
  fetchOfficialPrices,
  isSafePremium,
  loadStockTokens,
  premiumBps,
  quoteUsdgToToken,
  referenceMid,
  tokensBySymbol,
} from "shared";
import { publicClient } from "../chain.js";

export type TradableEntry = {
  symbol: string;
  price: number;
  premiumBps: number | null;
  safe: boolean;
};

// A full scan is ~195 tokens x an onchain pool lookup + quote each — real
// RPC cost, not something to redo per request. Liquidity/pricing doesn't
// swing meaningfully minute to minute for this purpose, so a longer cache
// than the plain price proxy is fine.
const cacheTtlMs = 10 * 60_000;
let cached: { at: number; entries: TradableEntry[] } | null = null;
let pending: Promise<TradableEntry[]> | null = null;

async function scan(): Promise<TradableEntry[]> {
  const list = await loadStockTokens();
  const tokens = tokensBySymbol(list);
  const symbols = [...tokens.keys()];
  const references = await fetchOfficialPrices(symbols);

  const entries: TradableEntry[] = [];
  const batchSize = 15;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (symbol) => {
        const token = tokens.get(symbol)!;
        const quote = await quoteUsdgToToken(publicClient, token.tokenAddress, 50, token.tokenDecimals).catch(
          () => null,
        );
        if (!quote) return null;
        const official = references.get(symbol);
        const bps = official ? premiumBps(quote.price, referenceMid(official.bid, official.ask)) : null;
        return { symbol, price: quote.price, premiumBps: bps, safe: isSafePremium(bps) } satisfies TradableEntry;
      }),
    );
    for (const entry of results) if (entry) entries.push(entry);
  }
  return entries;
}

function refresh(): Promise<TradableEntry[]> {
  // A network hiccup here (DNS, Robinhood's API down, ...) must never take
  // the whole process down — this promise is awaited by tradableEntries()
  // but also fired-and-forgotten by warmTradableCache() and the
  // stale-while-revalidate path below, so it can never be allowed to
  // reject. Fall back to whatever's cached, or empty if nothing is yet.
  pending ??= scan()
    .then((entries) => {
      cached = { at: Date.now(), entries };
      return entries;
    })
    .catch((error) => {
      console.error("tradable scan failed, keeping previous result", error);
      return cached?.entries ?? [];
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

// Stale-while-revalidate: a full scan takes real RPC time (~20s cold), so
// once anything is cached, callers get it immediately and a refresh runs in
// the background — nobody blocks on the scan after the first one completes.
export async function tradableEntries(): Promise<TradableEntry[]> {
  if (cached) {
    if (Date.now() - cached.at >= cacheTtlMs) void refresh();
    return cached.entries;
  }
  return refresh();
}

// Fire-and-forget warm-up so the first real request doesn't pay the cold
// scan cost.
export function warmTradableCache(): void {
  void refresh();
}
