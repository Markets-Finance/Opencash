import { erc20Abi, type Address, type PublicClient } from "viem";
import { fetchDisplayedBalance, type StockTokenEntry } from "../hood/registry.js";
import { quoteUsdgToToken } from "../hood/quote.js";
import type { Bin } from "./types.js";

export type BinLegPosition = {
  symbol: string;
  token: StockTokenEntry;
  shares: number;
  valueUsdg: number;
};

export type BinPosition = {
  bin: Bin;
  legs: BinLegPosition[];
  valueUsdg: number;
};

export async function fetchBinPosition(
  client: PublicClient,
  bin: Bin,
  tokens: Map<string, StockTokenEntry>,
  owner: Address,
): Promise<BinPosition | null> {
  const legs: BinLegPosition[] = [];

  await Promise.all(
    bin.legs.map(async (leg) => {
      const token = tokens.get(leg.symbol);
      if (!token) return;

      const rawBalance = await client.readContract({
        address: token.tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [owner],
      });
      if (rawBalance === 0n) return;

      const shares = await fetchDisplayedBalance(
        client,
        token.tokenAddress,
        rawBalance,
        token.tokenDecimals,
      );

      // Reverse-quote the token back into USDG at the current price by
      // pricing a small reference amount and scaling — quoteUsdgToToken only
      // prices USDG -> token, so approximate value via that same pool's rate.
      const reference = await quoteUsdgToToken(client, token.tokenAddress, 1, token.tokenDecimals);
      const valueUsdg = reference && reference.tokensOut > 0 ? shares / reference.tokensOut : 0;

      legs.push({ symbol: leg.symbol, token, shares, valueUsdg });
    }),
  );

  if (legs.length === 0) return null;

  return {
    bin,
    legs,
    valueUsdg: legs.reduce((sum, leg) => sum + leg.valueUsdg, 0),
  };
}
