import { perpl, templates } from "shared";

type LiveDeps = templates.LiveDeps;
type LivePosition = templates.LivePosition;
import type { Address } from "viem";
import { contextFor, type Net } from "../analytics/context.js";
import { chainReads, execWindowBlocks } from "../runner/adapter.js";

const settleMs = 4000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function failures(result: perpl.SubmitResult): string {
  const parts = [result.status.code !== 0 ? `${result.status.code} ${result.status.error ?? ""}` : "", ...result.statuses.map((item) => (item.code !== 0 ? `${item.code} ${item.error ?? ""}` : ""))];
  return parts.filter((part) => part.trim() !== "").join("; ");
}

export function perplLiveDeps(net: Net, owner: string, trade: perpl.TradeClient | null, wait: (ms: number) => Promise<void> = sleep): LiveDeps {
  const reads = chainReads(net, owner as Address);
  const api = perpl.createPerplApi(contextFor(net).deployment.apiUrl);

  async function market(symbol: string): Promise<perpl.PerpMarket> {
    const found = (await reads.markets()).find((m) => m.symbol === symbol);
    if (!found) throw new Error(`Unknown market ${symbol}`);
    return found;
  }

  async function position(symbol: string): Promise<LivePosition> {
    const account = await reads.account();
    if (!account) return { qty: 0, avgPx: 0 };
    const held = (await reads.held(account.accountId)).find((p) => p.symbol === symbol);
    return held ? { qty: held.side === "long" ? held.lots : -held.lots, avgPx: held.entryPrice } : { qty: 0, avgPx: 0 };
  }

  async function snapshot() {
    if (!trade) throw new Error("No trade key saved for this wallet");
    const account = await reads.account();
    if (!account) throw new Error("This wallet has no Perpl account yet");
    const snap = await trade.account();
    if (!snap.forwarding) throw new Error("One-Click Trading is off for this account");
    if (snap.frozen) throw new Error("This Perpl account is frozen");
    if (BigInt(snap.id) !== account.accountId) throw new Error("The trade key belongs to a different Perpl account");
    return { trade, snap };
  }

  async function close(symbol: string, side: "long" | "short", lots: number) {
    const { trade: client, snap } = await snapshot();
    const spec = perpl.closeSpec({ market: await market(symbol), accountId: snap.id, side, lots, requestId: client.nextRequestId(snap.lastRequestId), lastExecBlock: snap.headBlock + execWindowBlocks });
    return client.submit([spec]);
  }

  return {
    now: Date.now,

    async candles(symbol, resolution, since) {
      const apiMarket = (await api.getMarkets()).find((m) => m.symbol === symbol);
      if (!apiMarket) throw new Error(`Unknown market ${symbol}`);
      const rows = await api.getCandles(apiMarket, resolution, since, Date.now());
      return rows.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volumeUsd, trades: c.trades }));
    },

    position,

    markPrice: async (symbol) => (await market(symbol)).mark,

    guard: async () => ({ allowed: true, reason: "" }),

    async enter(symbol, usd, { leverage, reduceOnly }) {
      const m = await market(symbol);
      const before = await position(symbol);
      const lotUnit = 10 ** m.lotDecimals;
      const units = Math.floor((Math.abs(usd) / m.mark) * lotUnit);
      if (units <= 0) throw new Error(`$${Math.abs(usd).toFixed(2)} is below one lot of ${symbol}`);
      const lots = units / lotUnit;
      let result: perpl.SubmitResult;
      if (reduceOnly) {
        result = await close(symbol, before.qty > 0 ? "long" : "short", Math.min(lots, Math.abs(before.qty)));
      } else {
        const { trade: client, snap } = await snapshot();
        const spec = perpl.openSpec({ market: m, accountId: snap.id, side: usd > 0 ? "long" : "short", lots, leverage, requestId: client.nextRequestId(snap.lastRequestId), lastExecBlock: snap.headBlock + execWindowBlocks });
        result = await client.submit([spec]);
      }
      await wait(settleMs);
      const after = await position(symbol);
      if (Math.abs(after.qty - before.qty) < 1 / lotUnit / 2) throw new Error(`Perpl did not fill the order${result.ok ? "" : `: ${failures(result)}`}`);
    },

    async exit(symbol) {
      const held = await position(symbol);
      if (held.qty === 0) return;
      const result = await close(symbol, held.qty > 0 ? "long" : "short", Math.abs(held.qty));
      await wait(settleMs);
      if ((await position(symbol)).qty !== 0) throw new Error(`Close did not complete for ${symbol}${result.ok ? "" : `: ${failures(result)}`}`);
    },

    cancel: async () => {
      throw new Error("Resting orders are not supported on Perpl yet");
    },
    placeLimits: async () => {
      throw new Error("Resting orders are not supported on Perpl yet");
    },
    orderFills: async () => [],
  };
}
