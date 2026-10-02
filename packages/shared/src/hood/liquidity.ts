// A Uniswap V3 pool can exist and still return a quote while holding almost
// no real liquidity — the quote succeeds, but the price is nowhere near the
// real market. Verified against live pools: roughly half of Robinhood
// Chain's ~195 registered Stock Tokens price within a few percent of
// Robinhood's own reference feed; the rest can be off by 10x-1,000,000x+.
// This compares a Uniswap quote against that reference feed and rejects
// anything too far out, rather than trusting "a quote came back" alone.
export const maxSafePremiumBps = 300;

export function referenceMid(bid: number, ask: number): number {
  return (bid + ask) / 2;
}

export function premiumBps(uniswapPrice: number, referencePrice: number): number | null {
  if (!(referencePrice > 0)) return null;
  return ((uniswapPrice - referencePrice) / referencePrice) * 10000;
}

export function isSafePremium(bps: number | null): boolean {
  return bps !== null && Math.abs(bps) <= maxSafePremiumBps;
}
