import type { IntentsToken, Quote } from "./types.js";

export const monadMonAssetId = "nep245:v2_1.omni.hot.tg:143_11111111111111111111";
export const monadUsdcAssetId = "nep245:v2_1.omni.hot.tg:143_2dmLwYWkCQKyTjeUPAsGJuiVLbFx";
export const monadUsdcAddress = "0x754704bc059f8c67012fed69bc8a327a5aafb603";

const preferred = ["USDC", "USDT", "ETH", "SOL", "BTC", "MON", "BNB", "XRP"];

export type FundingSource = IntentsToken & { rank: number };

export function fundingSources(tokens: IntentsToken[]): FundingSource[] {
  return tokens
    .filter((token) => token.blockchain !== "monad" && token.price > 0)
    .map((token) => {
      const index = preferred.indexOf(token.symbol);
      return { ...token, rank: index === -1 ? preferred.length : index };
    })
    .sort((a, b) => a.rank - b.rank || a.blockchain.localeCompare(b.blockchain));
}

export function toBaseUnits(amount: number, decimals: number): string {
  const [whole, fraction = ""] = amount.toFixed(Math.min(decimals, 8)).split(".");
  return `${whole}${fraction.padEnd(decimals, "0")}`.replace(/^0+(?=\d)/, "");
}

export function costBps(quote: Quote): number | null {
  const input = Number(quote.amountInUsd);
  const output = Number(quote.amountOutUsd);
  if (!(input > 0) || !(output >= 0)) return null;
  return ((input - output) / input) * 1e4;
}

const evmChains = new Set(["eth", "base", "arb", "op", "pol", "bsc", "avax", "gnosis", "bera", "scroll", "xlayer", "plasma", "abs", "hood"]);

export function isEvmChain(chain: string): boolean {
  return evmChains.has(chain);
}

export function monadDestinations(tokens: IntentsToken[]): IntentsToken[] {
  return tokens.filter((token) => token.blockchain === "monad" && ["USDC", "USDT0", "MON"].includes(token.symbol));
}
