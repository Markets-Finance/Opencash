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
  previewFloor,
  suppliedUsdc,
} from "shared";

const network = "testnet";
const maxNotionalUsd = 10.5;
const hex = (k: string) => (k.startsWith("0x") ? k : `0x${k}`) as `0x${string}`;
const main = privateKeyToAccount(hex(process.env.MAIN_PRIVATE_KEY ?? ""));
const agent = privateKeyToAccount(hex(process.env.HL_TESTNET_AGENT_KEY ?? ""));
const info = createHlInfo(network);
const agentX = createHlExchange(network, agent);
const builder = { address: main.address, feeTenthsBps: 10 };

async function balances(label: string) {
  const [perp, spot, lent] = await Promise.all([
    getAccount(info, main.address),
    getSpotBalances(info, main.address),
    suppliedUsdc(info, main.address),
  ]);
  const usdc = spot.find((b) => b.coin === "USDC")?.total ?? 0;
  console.log(`${label}: perp equity ${perp.equity.toFixed(4)} | spot USDC ${usdc.toFixed(4)} | lent ${lent.toFixed(4)} | positions ${perp.positions.map((p) => `${p.coin} ${p.size} ${p.leverageType} ${p.leverage}x`).join(", ") || "none"}`);
  return { perp: perp.equity, spot: usdc, lent };
}

const markets = await listMarkets(info, "");
const eth = markets.find((m) => m.name === "ETH")!;
const plan = { market: eth, amountUsd: 19.8, floorPct: 0.9, sleeveLeverage: 5, isLong: true };
const preview = previewFloor(plan);
console.log("preview", JSON.stringify({ ...preview, mark: eth.markPx }));

const before = await balances("before");
const record = await openFloor(agentX, info, main.address, plan, { maxNotionalUsd, builder });
console.log("opened", JSON.stringify(record));
const during = await balances("open");
console.log("isolation check: spot+lent moved by", (during.spot + during.lent - before.spot - before.lent).toFixed(4), "(expected 0); perp moved by", (during.perp - before.perp).toFixed(4));

const [status] = await floorStatus(info, main.address, [record], await listMarkets(info, ""));
console.log("status", JSON.stringify({ knockedOut: status.knockedOut, floor: status.floorValueUsd.toFixed(4), sleeve: status.sleeveValueUsd.toFixed(4), total: status.totalUsd.toFixed(4), mark: status.markPx, knockOut: status.knockOutPx, distance: (status.distanceToKnockOutPct * 100).toFixed(2) + "%" }));

const closed = await closeFloor(agentX, info, main.address, record, await listMarkets(info, ""), status.floorValueUsd, { maxNotionalUsd, builder });
console.log("closed", JSON.stringify(closed));
const after = await balances("after");
console.log("round trip: total moved by", (after.perp + after.spot + after.lent - before.perp - before.spot - before.lent).toFixed(4));
