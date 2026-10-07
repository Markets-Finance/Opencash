import { privateKeyToAccount } from "viem/accounts";
import {
  closeFloor,
  createHlExchange,
  createHlInfo,
  floorStatus,
  getAccount,
  getSpotBalances,
  listMarkets,
  openFloor,
  placeLimitOrder,
  rearmFloor,
  suppliedUsdc,
} from "shared";

const network = "testnet";
const maxNotionalUsd = 10.5;
const hex = (k: string) => (k.startsWith("0x") ? k : `0x${k}`) as `0x${string}`;
const main = privateKeyToAccount(hex(process.env.MAIN_PRIVATE_KEY ?? ""));
const agent = privateKeyToAccount(hex(process.env.HL_TESTNET_AGENT_KEY ?? ""));
const info = createHlInfo(network);
const agentX = createHlExchange(network, agent);
const mainX = createHlExchange(network, main);
const options = { maxNotionalUsd, builder: { address: main.address, feeTenthsBps: 10 } };

async function snap(label: string, dex = "") {
  const [perp, spot, lent] = await Promise.all([getAccount(info, main.address, dex), getSpotBalances(info, main.address), suppliedUsdc(info, main.address)]);
  console.log(`${label}: ${dex || "main"} equity ${perp.equity.toFixed(4)} | spot USDC ${(spot.find((b) => b.coin === "USDC")?.total ?? 0).toFixed(4)} | lent ${lent.toFixed(4)} | ${perp.positions.map((p) => `${p.coin} ${p.size} ${p.leverageType} ${p.leverage}x`).join(", ") || "no positions"}`);
}

const main_ = await listMarkets(info, "");
const eth = main_.find((m) => m.name === "ETH")!;
await snap("rearm/start");
let record = await openFloor(agentX, info, main.address, { market: eth, amountUsd: 19.8, floorPct: 0.9, sleeveLeverage: 5, isLong: true }, options);
console.log("opened floor", record.floorUsd.toFixed(2), "sleeve", record.sleeveUsd.toFixed(2));
await placeLimitOrder(agentX, { assetId: eth.assetId, isBuy: false, price: eth.markPx * 0.99, size: record.size, szDecimals: eth.szDecimals, kind: "perp", tif: "Ioc", reduceOnly: true, maxNotionalUsd });
const [ko] = await floorStatus(info, main.address, [record], await listMarkets(info, ""));
console.log("simulated knock-out → knockedOut", ko.knockedOut, "floor value", ko.floorValueUsd.toFixed(4));
record = await rearmFloor(agentX, mainX, info, main.address, record, eth, 2.06, options);
console.log("re-armed: new floor", record.floorUsd.toFixed(2), "new sleeve", record.sleeveUsd.toFixed(2), "size", record.size, "entry", record.entryPx);
await snap("rearm/re-armed");
const [st] = await floorStatus(info, main.address, [record], await listMarkets(info, ""));
console.log("closed", JSON.stringify(await closeFloor(agentX, info, main.address, record, await listMarkets(info, ""), st.floorValueUsd, options)));
await snap("rearm/end");

const xyz = await listMarkets(info, "xyz");
const sp = xyz.find((m) => m.name === "xyz:SP500") ?? xyz.find((m) => m.markPx > 0)!;
console.log("\nxyz market", sp.name, "mark", sp.markPx, "maxLev", sp.maxLeverage);
await snap("xyz/start", "xyz");
try {
  const r = await openFloor(agentX, info, main.address, { market: sp, amountUsd: 19.8, floorPct: 0.9, sleeveLeverage: 5, isLong: true }, options);
  console.log("xyz floor opened size", r.size, "entry", r.entryPx);
  await snap("xyz/open", "xyz");
  const [s2] = await floorStatus(info, main.address, [r], await listMarkets(info, "xyz"));
  console.log("xyz status total", s2.totalUsd.toFixed(4), "knockOut", s2.knockOutPx, "distance", (100 * s2.distanceToKnockOutPct).toFixed(2) + "%");
  console.log("xyz closed", JSON.stringify(await closeFloor(agentX, info, main.address, r, await listMarkets(info, "xyz"), s2.floorValueUsd, options)));
} catch (e) {
  console.log("xyz floor FAIL", String(e).slice(0, 240));
}
await snap("xyz/end", "xyz");
await snap("final");
