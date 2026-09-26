import type { Address, PublicClient } from "viem";
import { exchangeAbi } from "./abi.js";
import { fromLNS, fromPNS, fromLeverageHdths, toLNS } from "./scale.js";

export type PerpMarket = {
  perpId: number;
  name: string;
  symbol: string;
  priceDecimals: number;
  lotDecimals: number;
  mark: number;
  longOpenInterest: number;
  shortOpenInterest: number;
  fundingRatePct100k: number;
  numOrders: number;
  status: number;
};

export type MarginTerms = {
  maxLeverage: number;
  dynamicMaxLeverage: number;
  maintenanceLeverage: number;
  openInterestCap: number;
};

export function marketIdsFromBitmap(
  bitmap: readonly [bigint, bigint, bigint, bigint],
): number[] {
  const ids: number[] = [];
  bitmap.forEach((word, index) => {
    for (let bit = 0n; word >> bit > 0n; bit += 1n) {
      if ((word >> bit) & 1n) ids.push(index * 256 + Number(bit));
    }
  });
  return ids;
}

export async function fetchMarketIds(
  client: PublicClient,
  exchange: Address,
): Promise<number[]> {
  const bitmap = await client.readContract({
    address: exchange,
    abi: exchangeAbi,
    functionName: "getPerpetualExistsBitmap",
  });
  return marketIdsFromBitmap(bitmap);
}

export async function fetchMarket(
  client: PublicClient,
  exchange: Address,
  perpId: number,
): Promise<PerpMarket> {
  const info = await client.readContract({
    address: exchange,
    abi: exchangeAbi,
    functionName: "getPerpetualInfoV2",
    args: [BigInt(perpId)],
  });

  const priceDecimals = Number(info.priceDecimals);
  const lotDecimals = Number(info.lotDecimals);

  return {
    perpId,
    name: info.name,
    symbol: info.symbol,
    priceDecimals,
    lotDecimals,
    mark: fromPNS(info.markPNS, priceDecimals),
    longOpenInterest: fromLNS(info.longOpenInterestLNS, lotDecimals),
    shortOpenInterest: fromLNS(info.shortOpenInterestLNS, lotDecimals),
    fundingRatePct100k: Number(info.fundingRatePct100k),
    numOrders: Number(info.numOrders),
    status: Number(info.status),
  };
}

export async function fetchMarginTerms(
  client: PublicClient,
  exchange: Address,
  market: PerpMarket,
  lots: number,
): Promise<MarginTerms> {
  const [initial, maintenance, dynamic, oiMax] = await client.readContract({
    address: exchange,
    abi: exchangeAbi,
    functionName: "getMarginFractions",
    args: [BigInt(market.perpId), toLNS(lots, market.lotDecimals)],
  });

  return {
    maxLeverage: fromLeverageHdths(initial),
    dynamicMaxLeverage: fromLeverageHdths(dynamic),
    maintenanceLeverage: fromLeverageHdths(maintenance),
    openInterestCap: fromLNS(oiMax, market.lotDecimals),
  };
}

export async function fetchMarkets(
  client: PublicClient,
  exchange: Address,
): Promise<PerpMarket[]> {
  const ids = await fetchMarketIds(client, exchange);
  return Promise.all(ids.map((id) => fetchMarket(client, exchange, id)));
}

export function marketsBySymbol(
  markets: PerpMarket[],
): Map<string, PerpMarket> {
  return new Map(markets.map((market) => [market.symbol, market]));
}
