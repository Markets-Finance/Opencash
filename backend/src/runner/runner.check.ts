import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { botActionMessage, botDigest, botMandateMessage, createBot, freshSignature, perpl, tradeKeyMessage, type StrategyCard } from "shared";
import { tickBot } from "shared";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { verifyMessage } from "viem";

process.env.BOT_KEY_SECRET = randomBytes(32).toString("hex");
const { createApiDeps } = await import("./adapter.js");
const { loadKey, saveKey, hasKey } = await import("./vault.js");
process.chdir(mkdtempSync(join(tmpdir(), "runner-")));

const owner = privateKeyToAccount(generatePrivateKey());
const card: StrategyCard = {
  name: "Spread",
  thesis: "",
  kind: "pair",
  marginUsd: 100,
  stopLossPct: 8,
  legs: [
    { symbol: "BTC", direction: "long", weightBps: 5000, leverage: 3 },
    { symbol: "ETH", direction: "short", weightBps: 5000, leverage: 3 },
  ],
};

const digest = botDigest(card, "auto");
const issuedAt = Date.now();
const message = botMandateMessage(owner.address, "testnet", digest, issuedAt);
const signature = await owner.signMessage({ message });
console.assert(await verifyMessage({ address: owner.address, message, signature }), "mandate signature verifies");
console.assert(!(await verifyMessage({ address: owner.address, message: botMandateMessage(owner.address, "testnet", botDigest({ ...card, marginUsd: 900 }, "auto"), issuedAt), signature })), "a changed card breaks the mandate");
console.assert(botDigest({ ...card, signal: "nansen" }, "auto") !== digest, "the Nansen signal is part of the digest");
console.assert(botActionMessage("bot-1", "enable", issuedAt).startsWith("Enable bot bot-1"), "action message");
console.assert(freshSignature(Date.now()) && !freshSignature(Date.now() - 3_600_000), "signature freshness window");
console.assert(tradeKeyMessage(owner.address, "testnet", "token-abcdef", issuedAt).includes("Key: "), "key message names a digest, not the key");
console.assert(!tradeKeyMessage(owner.address, "testnet", "token-abcdef", issuedAt).includes("token-abcdef"), "key message does not leak the token");

const secretHex = randomBytes(32).toString("hex");
await saveKey(owner.address, "testnet", "token-abcdef", secretHex);
const loaded = await loadKey(owner.address, "testnet");
console.assert(loaded?.secretHex === secretHex && loaded.apiKey === "token-abcdef", "vault round trip");
console.assert((await loadKey(owner.address, "mainnet")) === null && (await hasKey(owner.address, "testnet")), "vault is per network");
console.assert(!readFileSync("data/bot-keys.json", "utf8").includes(secretHex), "secret is not stored in plain text");

const market = (symbol: string, perpId: number, mark: number) => ({ symbol, perpId, mark, priceDecimals: 1, lotDecimals: 5, name: symbol, numOrders: 9 }) as unknown as perpl.PerpMarket;
const markets = [market("BTC", 16, 80_000), market("ETH", 32, 2_500)];
const symbolOf = new Map(markets.map((item) => [item.perpId, item.symbol]));

function world(options: { forwarding?: boolean; balance?: number; fillOnly?: string[] } = {}) {
  const held: { symbol: string; side: "long" | "short"; lots: number }[] = [];
  const batches: perpl.OrderSpec[][] = [];
  const resting: { oid: number; mkt: number; t: number; tp: number }[] = [];
  let counter = 0;
  const trade = {
    account: async () => ({ id: 7, forwarding: options.forwarding ?? true, frozen: false, lastRequestId: 20, balanceRaw: 0, lockedRaw: 0, headBlock: 1000 }),
    nextRequestId: (last: number) => (counter = Math.max(counter, last) + 1),
    submit: async (specs: perpl.OrderSpec[]) => {
      batches.push(specs);
      for (const spec of specs) {
        if (spec.t === 5) {
          resting.splice(resting.findIndex((order) => order.oid === spec.oid), 1);
          continue;
        }
        if (spec.tp) {
          resting.push({ oid: 900 + resting.length, mkt: spec.mkt, t: spec.t, tp: spec.tp });
          continue;
        }
        const symbol = symbolOf.get(spec.mkt)!;
        if (spec.t === 1 || spec.t === 2) {
          if (!options.fillOnly || options.fillOnly.includes(symbol)) held.push({ symbol, side: spec.t === 1 ? "long" : "short", lots: spec.s! / 1e5 });
        } else {
          const index = held.findIndex((item) => item.symbol === symbol);
          if (index >= 0) held.splice(index, 1);
        }
      }
      return { ok: true, status: { code: 0 }, statuses: specs.map(() => ({ code: 0 })) };
    },
    openOrders: async () => ({ d: resting }),
  } as unknown as perpl.TradeClient;
  const reads = {
    account: async () => ({ accountId: 7n, balance: options.balance ?? 1000 }),
    held: async () =>
      held.map((item) => ({ symbol: item.symbol, side: item.side, lots: item.lots, notionalUsd: 0, entryPrice: 1000, markPrice: 1000, marginUsd: 50, leverage: 3, unrealizedPnlUsd: 1, liquidationPrice: null, liquidationDistancePct: null })),
    markets: async () => markets,
  };
  return { held, batches, resting, trade, reads };
}

const toolbox = { getMarkets: async () => [{ symbol: "BTC", maxLeverage: 15 }, { symbol: "ETH", maxLeverage: 12 }] } as never;
const serverBot = (over: Partial<ReturnType<typeof createBot>> = {}, theCard = card) =>
  ({ ...createBot("Spread", "auto", theCard, Date.now()), ...over, enabled: true, owner: owner.address, net: "testnet", mandate: { digest, signature, issuedAt } }) as never;
const make = (w: ReturnType<typeof world>, others: unknown[] = [], pulses: (s: string[]) => Promise<never> = async () => [] as never, theCard = card) =>
  createApiDeps({ bot: serverBot({}, theCard), others: () => others as never, toolbox, trade: w.trade, reads: w.reads, pulses, wait: async () => {} });

const good = world();
await make(good).open(card);
console.assert(good.batches.length === 1 && good.batches[0].length === 2, "one batch with both legs", good.batches.length);
const [long, short] = good.batches[0];
console.assert(long.t === 1 && short.t === 2 && long.fl === 4 && long.lb === 1010 && long.rq === 21 && short.rq === 22, "order specs", [long, short]);
console.assert(good.held.length === 2, "both legs open");

const partial = world({ fillOnly: ["BTC"] });
const partialError = await make(partial).open(card).then(() => "", (error: Error) => error.message);
console.assert(partialError.includes("Only 1 of 2") && partial.batches.length === 2 && partial.batches[1][0].t === 3 && partial.held.length === 0, "partial fill is rolled back", partialError);

const none = world({ fillOnly: [] });
console.assert((await make(none).open(card).then(() => "", (error: Error) => error.message)).includes("did not fill"), "nothing filled is an error");

console.assert((await make(world({ forwarding: false })).open(card).then(() => "", (error: Error) => error.message)).includes("One-Click Trading"), "forwarding must be on");
console.assert((await make(world({ balance: 10 })).open(card).then(() => "", (error: Error) => error.message)).includes("Not enough free collateral"), "balance gate");
const other = { ...createBot("Other", "auto", { ...card, legs: [{ symbol: "BTC", direction: "short", weightBps: 10000, leverage: 2 }] }, 1), enabled: true };
const conflict = world();
console.assert((await make(conflict, [other]).open(card).then(() => "", (error: Error) => error.message)).includes("already used by"), "one owner per market");
console.assert(conflict.batches.length === 0, "nothing was sent on a conflict");

const guarded = world();
const stopCard = { ...card, stopLossPct: 10, takeProfitPct: 20, legs: [{ ...card.legs[0], weightBps: 10000 }] } as typeof card;
await make(guarded, [], undefined, stopCard).open(stopCard);
guarded.reads.held = async () => (guarded.held.length === 0 ? [] : [{ symbol: "BTC", side: "long", lots: 1, notionalUsd: 0, entryPrice: 80_000, markPrice: 80_000, marginUsd: 50, leverage: 2, unrealizedPnlUsd: 0, liquidationPrice: null, liquidationDistancePct: null }]);
const placed = await make(guarded, [], undefined, stopCard).protect!(stopCard);
const [stop, target] = guarded.batches[guarded.batches.length - 1];
console.assert(placed.length === 2 && stop.tp === 760_000 && stop.tpc === 4 && stop.t === 3 && target.tp === 880_000 && target.tpc === 3, "stop and target trigger specs", [placed, stop, target]);
console.assert((await make(guarded, [], undefined, stopCard).protect!(stopCard)).length === 0 && guarded.resting.length === 2, "stops are not placed twice");
await make(guarded, [], undefined, stopCard).close(stopCard);
console.assert(guarded.resting.length === 0, "resting stops cancelled on close", guarded.resting);

const closing = world();
await make(closing).open(card);
await make(closing).close(card);
console.assert(closing.held.length === 0 && closing.batches[1].map((spec) => spec.t).sort().join() === "3,4", "close sends close orders for both legs", closing.batches[1]);

const ticking = world();
const deps = { ...make(ticking), checkEntry: async () => ({ ok: true, reason: "test entry", carryAprPct: 1 }) };
const after = await tickBot(serverBot(), deps);
console.assert(after.status === "open" && after.opensToday.count === 1 && ticking.held.length === 2, "tickBot opens through the adapter", after.status);

const gated = world();
const gatedCard = { ...card, signal: "nansen" as const };
const gatedDeps = {
  ...make(gated, [], async () => [{ symbol: "BTC", tokens: ["BTC@x"], stance: "selling" }, { symbol: "ETH", tokens: ["ETH@x"], stance: "selling" }] as never, gatedCard),
  checkEntry: async () => ({ ok: true, reason: "test entry", carryAprPct: 1 }),
};
const blocked = await tickBot(serverBot({}, gatedCard), gatedDeps);
console.assert(blocked.lastCheck?.message.startsWith("Waiting on Nansen") && gated.batches.length === 0, "an opposing Nansen signal blocks the open", blocked.lastCheck);
console.log("ok");
