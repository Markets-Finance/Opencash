import { binFromCard, checkEntry, nansen, perpl, sizeBin, type BotDeps, type HeldLeg, type StrategyCard, type Toolbox } from "shared";
import type { Address } from "viem";
import { contextFor, type Net } from "../analytics/context.js";
import { heldPositions, marketBook, type HeldPosition } from "../analytics/positions.js";
import type { ServerBot } from "./store.js";
import { latestPositionTx } from "./txlookup.js";

export const execWindowBlocks = 10;
const settleMs = 4000;

export type Reads = {
  account(): Promise<{ accountId: bigint; balance: number } | null>;
  held(accountId: bigint): Promise<HeldPosition[]>;
  markets(): Promise<perpl.PerpMarket[]>;
  txSince?(accountId: bigint, fromBlock: number): Promise<string | undefined>;
};

export function chainReads(net: Net, owner: Address): Reads {
  const { client, deployment } = contextFor(net);
  return {
    account: async () => {
      const account = await perpl.fetchAccount(client, deployment.exchange, owner);
      return account ? { accountId: account.accountId, balance: account.balance } : null;
    },
    held: (accountId) => heldPositions(net, accountId),
    markets: async () => (await marketBook(net)).markets,
    txSince: (accountId, fromBlock) => latestPositionTx(net, accountId, BigInt(fromBlock)).catch(() => undefined),
  };
}

export type AdapterContext = {
  bot: ServerBot;
  others: () => ServerBot[];
  toolbox: Toolbox;
  trade: perpl.TradeClient;
  reads: Reads;
  pulses: (symbols: string[]) => Promise<nansen.SmartPulse[] | null>;
  wait?: (ms: number) => Promise<void>;
  now?: () => number;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function failures(result: perpl.SubmitResult): string {
  const parts = [result.status.code !== 0 ? `${result.status.code} ${result.status.error ?? ""}` : "", ...result.statuses.map((item) => (item.code !== 0 ? `${item.code} ${item.error ?? ""}` : ""))];
  return parts.filter((part) => part.trim() !== "").join("; ");
}

type RestingTrigger = { id: number; marketId: number; closeType: number };

async function restingTriggers(trade: perpl.TradeClient): Promise<RestingTrigger[]> {
  const rows = (await trade.openOrders()).d as { oid?: number; id?: number; mkt?: number; t?: number; tp?: number }[];
  return rows
    .filter((row) => (row.tp ?? 0) > 0 && (row.t === perpl.ApiOrderType.CloseLong || row.t === perpl.ApiOrderType.CloseShort))
    .map((row) => ({ id: row.oid ?? row.id ?? 0, marketId: row.mkt ?? 0, closeType: row.t! }));
}

export function createApiDeps(ctx: AdapterContext): BotDeps {
  const wait = ctx.wait ?? sleep;

  async function account() {
    const found = await ctx.reads.account();
    if (!found) throw new Error("This wallet has no Perpl account yet");
    return found;
  }

  async function snapshot(accountId: bigint) {
    const snap = await ctx.trade.account();
    if (!snap.forwarding) throw new Error("One-Click Trading is off for this account");
    if (snap.frozen) throw new Error("This Perpl account is frozen");
    if (BigInt(snap.id) !== accountId) throw new Error("The trade key belongs to a different Perpl account");
    return snap;
  }

  function matching(card: StrategyCard, held: HeldPosition[]): HeldPosition[] {
    return held.filter((position) => card.legs.some((leg) => leg.symbol === position.symbol && leg.direction === position.side));
  }

  async function closeAll(positions: HeldPosition[], accountId: bigint, bySymbol: Map<string, perpl.PerpMarket>) {
    const snap = await snapshot(accountId);
    const specs = positions.map((position) =>
      perpl.closeSpec({
        market: bySymbol.get(position.symbol)!,
        accountId: snap.id,
        side: position.side,
        lots: position.lots,
        requestId: ctx.trade.nextRequestId(snap.lastRequestId),
        lastExecBlock: snap.headBlock + execWindowBlocks,
      }),
    );
    return ctx.trade.submit(specs);
  }

  return {
    now: ctx.now ?? Date.now,

    heldLegs: async (card) => {
      const found = await ctx.reads.account();
      if (!found) return [];
      return matching(card, await ctx.reads.held(found.accountId)).map(
        (position): HeldLeg => ({ symbol: position.symbol, direction: position.side, depositUsd: position.marginUsd, pnlUsd: position.unrealizedPnlUsd }),
      );
    },

    checkEntry: (card, minCarry) => checkEntry(card, minCarry, ctx.toolbox),

    signalGate: async (card) => nansen.signalGate(card.legs, await ctx.pulses(card.legs.map((leg) => leg.symbol))),

    open: async (card) => {
      const mine = await account();
      for (const other of ctx.others()) {
        if (other.id === ctx.bot.id || !other.enabled) continue;
        const shared = other.card.legs.find((leg) => card.legs.some((own) => own.symbol === leg.symbol));
        if (shared) throw new Error(`${shared.symbol} is already used by the bot "${other.name}"`);
      }
      const markets = await ctx.reads.markets();
      const bySymbol = new Map(markets.map((market) => [market.symbol, market]));
      const maxLeverage = new Map((await ctx.toolbox.getMarkets()).map((market) => [market.symbol, market.maxLeverage]));
      const { sized, issues } = sizeBin(binFromCard(card), card.marginUsd, bySymbol, maxLeverage);
      if (sized.legs.length < card.legs.length) throw new Error(`Cannot size every leg: ${issues.map((issue) => issue.detail).join("; ")}`);
      if (sized.margin > card.marginUsd + 1e-6) throw new Error("Sized margin is above the bot's allocation cap");
      if (sized.margin > mine.balance) throw new Error(`Not enough free collateral: needs ${sized.margin.toFixed(2)}, has ${mine.balance.toFixed(2)}`);

      const snap = await snapshot(mine.accountId);
      const specs = sized.legs.map((leg) =>
        perpl.openSpec({
          market: bySymbol.get(leg.leg.symbol)!,
          accountId: snap.id,
          side: leg.leg.direction,
          lots: leg.lots,
          leverage: leg.leverage,
          requestId: ctx.trade.nextRequestId(snap.lastRequestId),
          lastExecBlock: snap.headBlock + execWindowBlocks,
        }),
      );
      const result = await ctx.trade.submit(specs);
      await wait(settleMs);

      const held = await ctx.reads.held(mine.accountId);
      const opened = held.filter((position) => sized.legs.some((leg) => leg.leg.symbol === position.symbol && leg.leg.direction === position.side));
      if (opened.length === sized.legs.length) return { txHash: await ctx.reads.txSince?.(mine.accountId, snap.headBlock) };
      if (opened.length === 0) throw new Error(`Perpl did not fill the order${result.ok ? "" : `: ${failures(result)}`}`);
      await closeAll(opened, mine.accountId, bySymbol);
      await wait(settleMs);
      throw new Error(`Only ${opened.length} of ${sized.legs.length} legs filled${result.ok ? "" : ` (${failures(result)})`}. The filled legs were closed again.`);
    },

    protect: async (card) => {
      const mine = await account();
      const positions = matching(card, await ctx.reads.held(mine.accountId));
      if (positions.length === 0) return [];
      const markets = await ctx.reads.markets();
      const bySymbol = new Map(markets.map((market) => [market.symbol, market]));
      const resting = await restingTriggers(ctx.trade);
      const snap = await snapshot(mine.accountId);
      const specs: perpl.OrderSpec[] = [];
      const placed: string[] = [];
      for (const position of positions) {
        const market = bySymbol.get(position.symbol);
        if (!market) throw new Error(`${position.symbol} is not listed`);
        const closeType = position.side === "long" ? perpl.ApiOrderType.CloseLong : perpl.ApiOrderType.CloseShort;
        const covered = resting.filter((order) => order.marketId === market.perpId && order.closeType === closeType).length;
        const leverage = position.leverage ?? card.legs.find((leg) => leg.symbol === position.symbol)?.leverage ?? 1;
        const wanted: [perpl.TriggerKind, number][] = [["stop", card.stopLossPct]];
        if (card.legs.length === 1 && card.takeProfitPct !== undefined) wanted.push(["target", card.takeProfitPct]);
        if (covered >= wanted.length) continue;
        for (const [kind, pct] of wanted.slice(covered)) {
          const triggerPrice = perpl.triggerPriceFor(position.entryPrice, position.side, kind, pct / leverage);
          specs.push(
            perpl.triggerSpec({
              market,
              accountId: snap.id,
              side: position.side,
              lots: position.lots,
              kind,
              triggerPrice,
              requestId: ctx.trade.nextRequestId(snap.lastRequestId),
              lastExecBlock: snap.headBlock + execWindowBlocks,
            }),
          );
          placed.push(`${kind} ${position.symbol} at ${Number(triggerPrice.toPrecision(5))}`);
        }
      }
      if (specs.length === 0) return [];
      const result = await ctx.trade.submit(specs);
      if (!result.ok) throw new Error(failures(result));
      return placed;
    },

    close: async (card) => {
      const mine = await account();
      const positions = matching(card, await ctx.reads.held(mine.accountId));
      if (positions.length === 0) return {};
      const markets = await ctx.reads.markets();
      const bySymbol = new Map(markets.map((market) => [market.symbol, market]));
      const stale = (await restingTriggers(ctx.trade)).filter((order) => positions.some((position) => bySymbol.get(position.symbol)?.perpId === order.marketId));
      if (stale.length > 0) {
        const snap = await snapshot(mine.accountId);
        await ctx.trade.submit(
          stale.map((order) => perpl.cancelSpec({ marketId: order.marketId, accountId: snap.id, orderId: order.id, requestId: ctx.trade.nextRequestId(snap.lastRequestId) })),
        );
      }
      const fromBlock = (await snapshot(mine.accountId)).headBlock;
      const result = await closeAll(positions, mine.accountId, bySymbol);
      await wait(settleMs);
      const left = matching(card, await ctx.reads.held(mine.accountId));
      if (left.length > 0) throw new Error(`Close did not complete for ${left.map((position) => position.symbol).join(", ")}${result.ok ? "" : `: ${failures(result)}`}`);
      return { txHash: await ctx.reads.txSince?.(mine.accountId, fromBlock) };
    },
  };
}
