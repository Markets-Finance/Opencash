import type { PublicClient } from "viem";
import { isSafePremium, premiumBps, referenceMid } from "../hood/liquidity.js";
import { fetchOfficialPrices, type OfficialQuote } from "../hood/prices.js";
import { quoteUsdgToToken } from "../hood/quote.js";
import type { StockTokenEntry } from "../hood/registry.js";
import type { Bin, BinSizingIssue, SizedBin, SizedLeg } from "./types.js";

export const totalWeightBps = 10000;

export function validateBin(bin: Bin): void {
  const total = bin.legs.reduce((sum, leg) => sum + leg.weightBps, 0);
  if (total !== totalWeightBps) {
    throw new Error(
      `Bin ${bin.id} weights sum to ${total}, expected ${totalWeightBps}`,
    );
  }
}

export async function sizeBin(
  client: PublicClient,
  bin: Bin,
  usdgAmount: number,
  tokens: Map<string, StockTokenEntry>,
  // Browsers can't call api.robinhood.com directly (no CORS headers) — web
  // callers inject a backend-proxied fetcher here. Node callers (mobile,
  // the backend itself) are fine with the default direct call. Either way,
  // a failure here degrades to skipping the price-deviation check rather
  // than blocking sizing entirely — a quote is still validated for
  // liquidity below, just not cross-checked against a reference price.
  fetchPrices: (symbols: string[]) => Promise<Map<string, OfficialQuote>> = fetchOfficialPrices,
): Promise<{ sized: SizedBin; issues: BinSizingIssue[] }> {
  validateBin(bin);

  const issues: BinSizingIssue[] = [];
  const legs: SizedLeg[] = [];
  const references = await fetchPrices(bin.legs.map((leg) => leg.symbol)).catch(
    () => new Map<string, OfficialQuote>(),
  );

  await Promise.all(
    bin.legs.map(async (leg) => {
      const token = tokens.get(leg.symbol);
      if (!token) {
        issues.push({
          symbol: leg.symbol,
          reason: "unknown-token",
          detail: `${leg.symbol} is not in the Robinhood Chain stock-token registry`,
        });
        return;
      }

      const legUsdg = (usdgAmount * leg.weightBps) / totalWeightBps;
      const quote = await quoteUsdgToToken(
        client,
        token.tokenAddress,
        legUsdg,
        token.tokenDecimals,
      );

      if (!quote) {
        issues.push({
          symbol: leg.symbol,
          reason: "no-liquidity",
          detail: `${leg.symbol} has no USDG pool on Uniswap`,
        });
        return;
      }

      if (quote.tokensOut <= 0) {
        issues.push({
          symbol: leg.symbol,
          reason: "below-minimum",
          detail: `$${legUsdg.toFixed(2)} quotes to zero ${leg.symbol}`,
        });
        return;
      }

      const official = references.get(leg.symbol);
      if (official) {
        const bps = premiumBps(quote.price, referenceMid(official.bid, official.ask));
        if (!isSafePremium(bps)) {
          issues.push({
            symbol: leg.symbol,
            reason: "price-deviation",
            detail: `${leg.symbol}'s pool is too thin to trust — its quote is ${bps === null ? "far" : `${(bps / 100).toFixed(1)}%`} from the reference price`,
          });
          return;
        }
      }

      legs.push({ leg, token, usdgIn: legUsdg, quote });
    }),
  );

  return {
    sized: {
      bin,
      legs,
      usdgIn: legs.reduce((sum, leg) => sum + leg.usdgIn, 0),
    },
    issues,
  };
}
