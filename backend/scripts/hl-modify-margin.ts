import { privateKeyToAccount } from "viem/accounts";
import {
  cancelOrder,
  createHlExchange,
  createHlInfo,
  getAccount,
  listMarkets,
  modifyOrder,
  placeLimitOrder,
  setLeverage,
  updateIsolatedMargin,
} from "shared";

const network = "testnet";
const maxNotionalUsd = 10.5;
const hex = (k: string) => (k.startsWith("0x") ? k : `0x${k}`) as `0x${string}`;
const main = privateKeyToAccount(hex(process.env.MAIN_PRIVATE_KEY ?? ""));
const agent = privateKeyToAccount(hex(process.env.HL_TESTNET_AGENT_KEY ?? ""));
const info = createHlInfo(network);
const agentX = createHlExchange(network, agent);

async function step<T>(name: string, run: () => Promise<T>): Promise<T | undefined> {
  try {
    const out = await run();
    console.log(name, "OK", JSON.stringify(out).slice(0, 260));
    return out;
  } catch (error) {
    console.log(name, "FAIL", String(error).slice(0, 300));
    return undefined;
  }
}

const eth = (await listMarkets(info, "")).find((m) => m.name === "ETH")!;
const sizeFor = (price: number) =>
  Math.ceil((10.1 / price) * 10 ** eth.szDecimals) / 10 ** eth.szDecimals;
const ethOrders = async () =>
  (await info.openOrders({ user: main.address })).filter((o) => o.coin === "ETH");
const ethPosition = async () =>
  (await getAccount(info, main.address)).positions.find((p) => p.coin === "ETH");
if (await ethPosition()) throw new Error("ETH position already open; not touching it");
if ((await ethOrders()).length > 0) throw new Error("ETH orders already open; not touching them");
const before = await info.activeAssetData({ user: main.address, coin: "ETH" });
console.log("leverage before", JSON.stringify(before.leverage));

const restPx = eth.markPx * 0.9;
const placed = await step("rest Alo bid", () =>
  placeLimitOrder(agentX, { assetId: eth.assetId, isBuy: true, price: restPx, size: sizeFor(restPx), szDecimals: eth.szDecimals, kind: "perp", maxNotionalUsd }),
);
const status = placed?.response.data.statuses[0];
const oid = status && typeof status === "object" && "resting" in status ? status.resting.oid : undefined;
console.log("resting oid", oid);

if (oid !== undefined) {
  const newPx = eth.markPx * 0.92;
  await step("modifyOrder price+size", () =>
    modifyOrder(agentX, oid, { assetId: eth.assetId, isBuy: true, price: newPx, size: sizeFor(newPx), szDecimals: eth.szDecimals, kind: "perp", maxNotionalUsd }),
  );
  console.log("orders after modify", JSON.stringify((await ethOrders()).map((o) => [o.oid, o.limitPx, o.sz])));
}
for (const o of await ethOrders()) await step(`cancel ${o.oid}`, () => cancelOrder(agentX, eth.assetId, o.oid));

await step("isolated 5x", () => setLeverage(agentX, eth.assetId, 5, false));
const buyPx = eth.markPx * 1.01;
const size = sizeFor(buyPx);
await step("open isolated long Ioc", () =>
  placeLimitOrder(agentX, { assetId: eth.assetId, isBuy: true, price: buyPx, size, szDecimals: eth.szDecimals, kind: "perp", tif: "Ioc", maxNotionalUsd }),
);
const opened = await ethPosition();
console.log("position", JSON.stringify(opened));
if (opened) {
  const margin = async () =>
    (await info.clearinghouseState({ user: main.address })).assetPositions.find((a) => a.position.coin === "ETH")?.position.marginUsed;
  console.log("margin start", await margin());
  await step("add 1 USD margin", () => updateIsolatedMargin(agentX, eth.assetId, opened.size > 0, 1));
  console.log("margin after add", await margin());
  await step("remove 0.5 USD margin", () => updateIsolatedMargin(agentX, eth.assetId, opened.size > 0, -0.5));
  console.log("margin after remove", await margin());
  await step("close reduce-only Ioc", () =>
    placeLimitOrder(agentX, { assetId: eth.assetId, isBuy: false, price: eth.markPx * 0.99, size: Math.abs(opened.size), szDecimals: eth.szDecimals, kind: "perp", tif: "Ioc", reduceOnly: true, maxNotionalUsd }),
  );
}

await step("restore leverage", () =>
  setLeverage(agentX, eth.assetId, before.leverage.value, before.leverage.type === "cross"),
);
console.log("final position", JSON.stringify((await ethPosition()) ?? null));
console.log("final ETH orders", (await ethOrders()).length);
