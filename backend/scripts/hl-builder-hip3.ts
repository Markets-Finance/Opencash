import { privateKeyToAccount } from "viem/accounts";
import { createHlExchange, createHlInfo, getAccount, listMarkets, placeLimitOrder } from "shared";

const network = "testnet";
const maxNotionalUsd = 10.5;
const hex = (k: string) => (k.startsWith("0x") ? k : `0x${k}`) as `0x${string}`;
const main = privateKeyToAccount(hex(process.env.MAIN_PRIVATE_KEY ?? ""));
const agent = privateKeyToAccount(hex(process.env.HL_TESTNET_AGENT_KEY ?? ""));
const info = createHlInfo(network);
const mainX = createHlExchange(network, main);
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

const builder = { address: main.address, feeTenthsBps: 10 };

await step("approveBuilderFee (main, builder = own address, 0.05%)", () =>
  mainX.approveBuilderFee({ builder: builder.address, maxFeeRate: "0.05%" }),
);

const eth = (await listMarkets(info, "")).find((m) => m.name === "ETH")!;
const ethPrice = eth.markPx * 1.01;
const ethSize = Math.ceil((10 / ethPrice) * 10 ** eth.szDecimals) / 10 ** eth.szDecimals;
await step("ETH long with builder fee (agent)", () =>
  placeLimitOrder(agentX, { assetId: eth.assetId, isBuy: true, price: ethPrice, size: ethSize, szDecimals: eth.szDecimals, kind: "perp", tif: "Ioc", builder, maxNotionalUsd }),
);
await step("ETH close (agent)", () =>
  placeLimitOrder(agentX, { assetId: eth.assetId, isBuy: false, price: eth.markPx * 0.99, size: ethSize, szDecimals: eth.szDecimals, kind: "perp", tif: "Ioc", reduceOnly: true, builder, maxNotionalUsd }),
);

const fills = await info.userFills({ user: main.address });
console.log("fills", fills.length, JSON.stringify(fills.slice(0, 2).map((f) => [f.coin, f.dir, f.px, f.sz, f.fee, f.builderFee])));
console.log("main equity", (await getAccount(info, main.address)).equity);
