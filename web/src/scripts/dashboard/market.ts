import type { BinPosition } from "shared";
import { terminal, type MarketData } from "../perpl";
import { session } from "./state";

let marketData: Promise<MarketData> | null = null;
let positionsCache: BinPosition[] | null = null;

export function getMarketData(force = false): Promise<MarketData> {
  if (force || marketData === null) marketData = terminal.loadMarkets();
  return marketData;
}

export async function getPositions(force = false): Promise<BinPosition[]> {
  if (!session.trader) return [];
  if (positionsCache && !force) return positionsCache;
  positionsCache = await terminal.loadPositions(session.trader.address, await getMarketData());
  return positionsCache;
}
