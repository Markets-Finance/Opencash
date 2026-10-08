import type { PerpMarket } from "../perpl/markets.js";
import { loadBinInputs, type BinInputSource } from "./inputs.js";
import { sizeBin } from "./sizing.js";
import type { Bin, BinSizingIssue, SizedBin } from "./types.js";
import { allocate, type LegInputs, type WeightMode } from "./weights.js";

export type BinPlan = {
  sized: SizedBin;
  issues: BinSizingIssue[];
  usedMode: WeightMode;
  inputs: Map<string, LegInputs>;
};

export async function planBin(
  source: BinInputSource,
  bin: Bin,
  margin: number,
  data: { markets: Map<string, PerpMarket>; maxLeverage: Map<string, number> },
  mode: WeightMode = bin.mode ?? "fixed",
): Promise<BinPlan> {
  const inputs = await loadBinInputs(source, bin.legs.map((leg) => leg.symbol));
  const { legs, usedMode } = allocate(bin.legs, mode, inputs);
  const caps = new Map<string, number>();
  for (const leg of legs) {
    const depth = inputs.get(leg.symbol)?.depthUsd;
    if (depth !== undefined) caps.set(leg.symbol, depth);
  }
  const { sized, issues } = sizeBin({ ...bin, legs }, margin, data.markets, data.maxLeverage, caps);
  return { sized, issues, usedMode, inputs };
}
