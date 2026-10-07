export type BinDirection = "long" | "short";

export type BinLeg = {
  symbol: string;
  direction: BinDirection;
  weightBps: number;
  leverage: number;
};

export type Bin = {
  id: string;
  name: string;
  thesis: string;
  legs: BinLeg[];
};

export type SizedLeg = {
  leg: BinLeg;
  perpId: number;
  margin: number;
  notional: number;
  lots: number;
  mark: number;
  leverage: number;
};

export type SizedBin = {
  bin: Bin;
  legs: SizedLeg[];
  margin: number;
  notional: number;
};

export type BinSizingIssue = {
  symbol: string;
  reason: "unknown-market" | "no-liquidity" | "leverage-capped" | "below-minimum";
  detail: string;
};
