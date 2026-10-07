import { privateKeyToAccount } from "viem/accounts";
import { createHlExchange, createHlInfo, getAccount, listMarkets, placeLimitOrder } from "shared";

const network = "testnet";
const minNotionalUsd = 10;
const maxNotionalUsd = 10.5;
const hex = (k: string) => (k.startsWith("0x") ? k : `0x${k}`) as `0x${string}`;
const main = privateKeyToAccount(hex(process.env.MAIN_PRIVATE_KEY ?? ""));
const agent = privateKeyToAccount(hex(process.env.HL_TESTNET_AGENT_KEY ?? ""));
const info = createHlInfo(network);
const exchange = createHlExchange(network, agent);

const eth = (await listMarkets(info, "")).find((m) => m.name === "ETH");
if (!eth) throw new Error("ETH market not found");
console.log("ETH", eth.assetId, "mark", eth.markPx, "szDecimals", eth.szDecimals, "maxLev", eth.maxLeverage);

const price = eth.markPx * 1.01;
const step = 10 ** eth.szDecimals;
const size = Math.ceil((minNotionalUsd / price) * step) / step;
console.log("size", size.toFixed(eth.szDecimals), "notional", (size * price).toFixed(4));

try {
  const r = await placeLimitOrder(exchange, {
    assetId: eth.assetId, isBuy: true, price, size, szDecimals: eth.szDecimals, kind: "perp", tif: "Ioc", maxNotionalUsd,
  });
  console.log("order", JSON.stringify(r.response.data.statuses));
} catch (e) {
  console.log("order FAIL", String(e).slice(0, 240));
}
console.log("positions", JSON.stringify((await getAccount(info, main.address)).positions.map((p) => [p.coin, p.size, p.leverage])));
