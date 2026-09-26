import type { Address, PublicClient } from "viem";
import { exchangeAbi } from "./abi.js";
import type { PerpMarket } from "./markets.js";
import { fromCNS, fromLNS, fromPNS } from "./scale.js";

export type PerplAccount = {
  accountId: bigint;
  balance: number;
  lockedBalance: number;
  frozen: number;
  address: Address;
};

export type PerpPosition = {
  perpId: number;
  positionType: number;
  deposit: number;
  entryPrice: number;
  lots: number;
  entryBlock: bigint;
  pnl: number;
  mark: number;
  markValid: boolean;
};

export async function fetchAccount(
  client: PublicClient,
  exchange: Address,
  owner: Address,
): Promise<PerplAccount | null> {
  try {
    const info = await client.readContract({
      address: exchange,
      abi: exchangeAbi,
      functionName: "getAccountByAddr",
      args: [owner],
    });
    return {
      accountId: info.accountId,
      balance: fromCNS(info.balanceCNS),
      lockedBalance: fromCNS(info.lockedBalanceCNS),
      frozen: Number(info.frozen),
      address: info.accountAddr,
    };
  } catch {
    return null;
  }
}

export async function fetchPosition(
  client: PublicClient,
  exchange: Address,
  market: PerpMarket,
  accountId: bigint,
): Promise<PerpPosition | null> {
  const [position, markPricePNS, markPriceValid] = await client.readContract({
    address: exchange,
    abi: exchangeAbi,
    functionName: "getPosition",
    args: [BigInt(market.perpId), accountId],
  });

  if (position.lotLNS === 0n) return null;

  return {
    perpId: market.perpId,
    positionType: Number(position.positionType),
    deposit: fromCNS(position.depositCNS),
    entryPrice: fromPNS(position.pricePNS, market.priceDecimals),
    lots: fromLNS(position.lotLNS, market.lotDecimals),
    entryBlock: position.entryBlock,
    pnl: fromCNS(position.pnlCNS),
    mark: fromPNS(markPricePNS, market.priceDecimals),
    markValid: markPriceValid,
  };
}
