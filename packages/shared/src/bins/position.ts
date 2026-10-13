import type { Address, PublicClient } from "viem";
import { fetchPosition, type PerpPosition } from "../perpl/account.js";
import type { PerpMarket } from "../perpl/markets.js";
import type { Bin } from "./types.js";

export type BinPosition = {
  bin: Bin;
  legs: { symbol: string; position: PerpPosition }[];
  deposit: number;
  pnl: number;
};

export async function fetchBinPosition(
  client: PublicClient,
  exchange: Address,
  bin: Bin,
  markets: Map<string, PerpMarket>,
  accountId: bigint,
): Promise<BinPosition | null> {
  const found = await Promise.all(
    bin.legs.map(async (leg) => {
      const market = markets.get(leg.symbol);
      if (!market) return null;
      const position = await fetchPosition(client, exchange, market, accountId);
      return position ? { symbol: leg.symbol, position } : null;
    }),
  );
  const legs = found.filter((entry): entry is { symbol: string; position: PerpPosition } => entry !== null);

  if (legs.length === 0) return null;

  return {
    bin,
    legs,
    deposit: legs.reduce((sum, leg) => sum + leg.position.deposit, 0),
    pnl: legs.reduce((sum, leg) => sum + leg.position.pnl, 0),
  };
}
