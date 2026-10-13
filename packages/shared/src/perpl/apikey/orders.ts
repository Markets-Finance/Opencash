import type { PerpMarket } from "../markets.js";
import { OrderType, defaultMaxNegPnlCollatBps, defaultSlippageBps, limitPriceFor } from "../orders.js";
import { toLNS, toLeverageHdths, toPNS } from "../scale.js";

export const ApiOrderType = { OpenLong: 1, OpenShort: 2, CloseLong: 3, CloseShort: 4, Cancel: 5 } as const;

export const ApiOrderFlag = { GoodTillCancel: 0, PostOnly: 1, FillOrKill: 2, ImmediateOrCancel: 4 } as const;

export type OrderSpec = {
  rq: number;
  mkt: number;
  acc: number;
  oid?: number;
  t: number;
  p?: number;
  s?: number;
  mnp?: number;
  fl: number;
  lv: number;
  lb: number;
  tp?: number;
  tpc?: number;
  ms?: number;
};

export const TriggerCondition = { GTELast: 1, LTELast: 2, GTEMark: 3, LTEMark: 4 } as const;

export type TriggerKind = "stop" | "target";

type Side = "long" | "short";

export type OpenSpecInput = {
  market: PerpMarket;
  accountId: number;
  side: Side;
  lots: number;
  leverage: number;
  requestId: number;
  lastExecBlock: number;
  flag?: number;
  slippageBps?: number;
  price?: number;
  maxNegPnlCollatBps?: number;
};

export type CloseSpecInput = Omit<OpenSpecInput, "leverage" | "maxNegPnlCollatBps"> & { leverage?: number };

function priced(market: PerpMarket, chainType: number, slippageBps: number, price?: number): number {
  return Number(toPNS(price ?? limitPriceFor(market, chainType as never, slippageBps), market.priceDecimals));
}

export function openSpec(input: OpenSpecInput): OrderSpec {
  const chainType = input.side === "long" ? OrderType.OpenLong : OrderType.OpenShort;
  return {
    rq: input.requestId,
    mkt: input.market.perpId,
    acc: input.accountId,
    t: input.side === "long" ? ApiOrderType.OpenLong : ApiOrderType.OpenShort,
    p: priced(input.market, chainType, input.slippageBps ?? defaultSlippageBps, input.price),
    s: Number(toLNS(input.lots, input.market.lotDecimals)),
    mnp: input.maxNegPnlCollatBps ?? defaultMaxNegPnlCollatBps,
    fl: input.flag ?? ApiOrderFlag.ImmediateOrCancel,
    lv: Number(toLeverageHdths(input.leverage)),
    lb: input.lastExecBlock,
  };
}

export function closeSpec(input: CloseSpecInput): OrderSpec {
  const chainType = input.side === "long" ? OrderType.CloseLong : OrderType.CloseShort;
  return {
    rq: input.requestId,
    mkt: input.market.perpId,
    acc: input.accountId,
    t: input.side === "long" ? ApiOrderType.CloseLong : ApiOrderType.CloseShort,
    p: priced(input.market, chainType, input.slippageBps ?? defaultSlippageBps, input.price),
    s: Number(toLNS(input.lots, input.market.lotDecimals)),
    fl: input.flag ?? ApiOrderFlag.ImmediateOrCancel,
    lv: Number(toLeverageHdths(input.leverage ?? 1)),
    lb: input.lastExecBlock,
  };
}

export function cancelSpec(input: { marketId: number; accountId: number; orderId: number; requestId: number }): OrderSpec {
  return { rq: input.requestId, mkt: input.marketId, acc: input.accountId, oid: input.orderId, t: ApiOrderType.Cancel, fl: 0, lv: 0, lb: 0 };
}

export type TriggerSpecInput = Omit<CloseSpecInput, "price" | "slippageBps" | "flag"> & {
  kind: TriggerKind;
  triggerPrice: number;
  maxSlippageBps?: number;
};

export const defaultTriggerSlippageBps = 300;

export function triggerPriceFor(entry: number, side: Side, kind: TriggerKind, movePct: number): number {
  const down = (side === "long") === (kind === "stop");
  return entry * (down ? 1 - movePct / 100 : 1 + movePct / 100);
}

export function triggerCondition(side: Side, kind: TriggerKind): number {
  const down = (side === "long") === (kind === "stop");
  return down ? TriggerCondition.LTEMark : TriggerCondition.GTEMark;
}

export function triggerSpec(input: TriggerSpecInput): OrderSpec {
  const base = closeSpec(input);
  return {
    ...base,
    p: 0,
    ms: input.maxSlippageBps ?? defaultTriggerSlippageBps,
    fl: ApiOrderFlag.GoodTillCancel,
    tp: Number(toPNS(input.triggerPrice, input.market.priceDecimals)),
    tpc: triggerCondition(input.side, input.kind),
  };
}
