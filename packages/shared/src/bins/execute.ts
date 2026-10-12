import type { Address } from "viem";
import { exchangeAbi } from "../perpl/abi.js";
import type { PerpMarket } from "../perpl/markets.js";
import {
  OrderType,
  buildOrderDesc,
  type OrderDesc,
  type OrderTypeValue,
} from "../perpl/orders.js";
import { toCNS } from "../perpl/scale.js";
import type { SizedBin } from "./types.js";

function openingType(direction: "long" | "short"): OrderTypeValue {
  return direction === "long" ? OrderType.OpenLong : OrderType.OpenShort;
}

function closingType(positionType: number): OrderTypeValue {
  return positionType === OrderType.OpenLong
    ? OrderType.CloseLong
    : OrderType.CloseShort;
}

export type BinOrderOptions = {
  postOnly?: boolean;
  slippageBps?: number;
  maxNegPnlCollatBPS?: number;
  lastExecutionBlock?: bigint;
};

export function binEntryOrders(
  sized: SizedBin,
  markets: Map<string, PerpMarket>,
  options: BinOrderOptions = {},
): OrderDesc[] {
  return sized.legs.map((leg, index) => {
    const market = markets.get(leg.leg.symbol);
    if (!market) throw new Error(`Market ${leg.leg.symbol} missing at execution`);
    return buildOrderDesc({
      market,
      orderType: openingType(leg.leg.direction),
      lots: leg.lots,
      leverage: leg.leverage,
      amountCNS: toCNS(leg.margin),
      postOnly: options.postOnly ?? false,
      immediateOrCancel: !(options.postOnly ?? false),
      slippageBps: options.slippageBps,
      maxNegPnlCollatBPS: options.maxNegPnlCollatBPS,
      lastExecutionBlock: options.lastExecutionBlock,
      orderDescId: BigInt(index + 1),
    });
  });
}

export function binExitOrders(
  positions: { market: PerpMarket; positionType: number; lots: number }[],
  options: BinOrderOptions = {},
): OrderDesc[] {
  return positions.map((position, index) =>
    buildOrderDesc({
      market: position.market,
      orderType: closingType(position.positionType),
      lots: position.lots,
      leverage: 1,
      amountCNS: 0n,
      postOnly: options.postOnly ?? false,
      slippageBps: options.slippageBps,
      lastExecutionBlock: options.lastExecutionBlock,
      orderDescId: BigInt(index + 1),
    }),
  );
}

export function execOrdersRequest(
  exchange: Address,
  descs: OrderDesc[],
  revertOnFail: boolean,
) {
  return {
    address: exchange,
    abi: exchangeAbi,
    functionName: "execOrders",
    args: [descs, revertOnFail],
  } as const;
}
