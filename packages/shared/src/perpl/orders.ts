import type { PerpMarket } from "./markets.js";
import { toLNS, toLeverageHdths, toPNS } from "./scale.js";

export const OrderType = {
  OpenLong: 0,
  OpenShort: 1,
  CloseLong: 2,
  CloseShort: 3,
} as const;

export type OrderTypeValue = (typeof OrderType)[keyof typeof OrderType];

export type OrderDesc = {
  orderDescId: bigint;
  perpId: bigint;
  orderType: number;
  orderId: bigint;
  pricePNS: bigint;
  lotLNS: bigint;
  expiryBlock: bigint;
  postOnly: boolean;
  fillOrKill: boolean;
  immediateOrCancel: boolean;
  maxMatches: bigint;
  leverageHdths: bigint;
  lastExecutionBlock: bigint;
  amountCNS: bigint;
  maxNegPnlCollatBPS: bigint;
};

export type OrderInput = {
  market: PerpMarket;
  orderType: OrderTypeValue;
  lots: number;
  leverage: number;
  amountCNS: bigint;
  price?: number;
  slippageBps?: number;
  postOnly?: boolean;
  fillOrKill?: boolean;
  immediateOrCancel?: boolean;
  expiryBlock?: bigint;
  lastExecutionBlock?: bigint;
  maxMatches?: number;
  maxNegPnlCollatBPS?: number;
  orderDescId?: bigint;
};

export const defaultSlippageBps = 100;

export const defaultMaxNegPnlCollatBps = 500;

export function limitPriceFor(
  market: PerpMarket,
  orderType: OrderTypeValue,
  slippageBps: number = defaultSlippageBps,
): number {
  const buying =
    orderType === OrderType.OpenLong || orderType === OrderType.CloseShort;
  const drift = slippageBps / 10000;
  return buying ? market.mark * (1 + drift) : market.mark * (1 - drift);
}

export function isReduceOnly(orderType: OrderTypeValue): boolean {
  return orderType === OrderType.CloseLong || orderType === OrderType.CloseShort;
}

export function closingTypeFor(orderType: OrderTypeValue): OrderTypeValue {
  return orderType === OrderType.OpenLong
    ? OrderType.CloseLong
    : OrderType.CloseShort;
}

export function buildOrderDesc(input: OrderInput): OrderDesc {
  return {
    orderDescId: input.orderDescId ?? 0n,
    perpId: BigInt(input.market.perpId),
    orderType: input.orderType,
    orderId: 0n,
    pricePNS: toPNS(
      input.price ??
        limitPriceFor(input.market, input.orderType, input.slippageBps),
      input.market.priceDecimals,
    ),
    lotLNS: toLNS(input.lots, input.market.lotDecimals),
    expiryBlock: input.expiryBlock ?? 0n,
    postOnly: input.postOnly ?? false,
    fillOrKill: input.fillOrKill ?? false,
    immediateOrCancel: input.immediateOrCancel ?? false,
    maxMatches: BigInt(input.maxMatches ?? 0),
    leverageHdths: toLeverageHdths(input.leverage),
    lastExecutionBlock: input.lastExecutionBlock ?? 0n,
    amountCNS: input.amountCNS,
    maxNegPnlCollatBPS: BigInt(
      input.maxNegPnlCollatBPS ?? defaultMaxNegPnlCollatBps,
    ),
  };
}

export function toContractArgs(desc: OrderDesc) {
  return [
    desc.orderDescId,
    desc.perpId,
    desc.orderType,
    desc.orderId,
    desc.pricePNS,
    desc.lotLNS,
    desc.expiryBlock,
    desc.postOnly,
    desc.fillOrKill,
    desc.immediateOrCancel,
    desc.maxMatches,
    desc.leverageHdths,
    desc.lastExecutionBlock,
    desc.amountCNS,
    desc.maxNegPnlCollatBPS,
  ] as const;
}
