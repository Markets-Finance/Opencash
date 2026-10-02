import type { HoodQuote } from "../hood/quote.js";
import type { StockTokenEntry } from "../hood/registry.js";

export type BinLeg = {
  symbol: string;
  weightBps: number;
};

export type Bin = {
  id: string;
  name: string;
  thesis: string;
  legs: BinLeg[];
};

export type SizedLeg = {
  leg: BinLeg;
  token: StockTokenEntry;
  usdgIn: number;
  quote: HoodQuote;
};

export type SizedBin = {
  bin: Bin;
  legs: SizedLeg[];
  usdgIn: number;
};

export type BinSizingIssue = {
  symbol: string;
  reason: "unknown-token" | "no-liquidity" | "below-minimum" | "price-deviation";
  detail: string;
};
