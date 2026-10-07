import { privateKeyToAccount } from "viem/accounts";
import {
  cancelOrder,
  createHlExchange,
  createHlInfo,
  getAccount,
  getSpotBalances,
  listMarkets,
  listSpotMarkets,
  moveUsd,
  placeLimitOrder,
  withdrawUsd,
} from "shared";

const network = "testnet";
const hex = (k: string) => (k.startsWith("0x") ? k : `0x${k}`) as `0x${string}`;
const main = privateKeyToAccount(hex(process.env.MAIN_PRIVATE_KEY ?? ""));
const agent = privateKeyToAccount(hex(process.env.HL_TESTNET_AGENT_KEY ?? ""));
const info = createHlInfo(network);
const mainX = createHlExchange(network, main);
const agentX = createHlExchange(network, agent);

async function step(name: string, run: () => Promise<unknown>) {
  try {
    console.log(name, "OK", JSON.stringify(await run()).slice(0, 220));
  } catch (error) {
    console.log(name, "FAIL", String(error).slice(0, 260));
  }
}

const balances = async () => ({
  perp: (await getAccount(info, main.address)).withdrawable,
  spot: (await getSpotBalances(info, main.address)).map((b) => `${b.coin}:${b.total}`),
});

console.log("start", JSON.stringify(await balances()));
await step("perp->spot 20 USDC (main)", () => moveUsd(mainX, 20, false));
console.log("after transfer", JSON.stringify(await balances()));

const spot = (await listSpotMarkets(info)).filter((m) => m.quote === "USDC" && m.markPx > 0);
const pick = spot.sort((a, b) => b.dayNtlVlm - a.dayNtlVlm)[0];
console.log("spot pick", pick?.pair, pick?.assetId, pick?.markPx, "szDec", pick?.szDecimals, "of", spot.length);

if (pick) {
  const price = pick.markPx * 0.5;
  const size = 12 / price;
  let oid = 0;
  await step("spot buy post-only (agent)", async () => {
    const r = await placeLimitOrder(agentX, {
      assetId: pick.assetId, isBuy: true, price, size, szDecimals: pick.szDecimals, kind: "spot", maxNotionalUsd: 1,
    });
    const s = r.response.data.statuses[0] as { resting?: { oid: number } };
    oid = s.resting?.oid ?? 0;
    return r;
  });
  if (oid) await step("spot cancel (agent)", () => cancelOrder(agentX, pick.assetId, oid));
}

const btc = (await listMarkets(info, "")).find((m) => m.name === "BTC")!;
let boid = 0;
await step("perp buy post-only (agent)", async () => {
  const r = await placeLimitOrder(agentX, {
    assetId: btc.assetId, isBuy: true, price: btc.markPx * 0.9, size: 25 / (btc.markPx * 0.9), szDecimals: btc.szDecimals, kind: "perp", maxNotionalUsd: 1,
  });
  const s = r.response.data.statuses[0] as { resting?: { oid: number } };
  boid = s.resting?.oid ?? 0;
  return r;
});
if (boid) await step("perp cancel (agent)", () => cancelOrder(agentX, btc.assetId, boid));

await step("withdraw 5 USDC to own address (main)", () => withdrawUsd(mainX, 5, main.address, [main.address]));
console.log("end", JSON.stringify(await balances()));
