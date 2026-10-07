import { appendFileSync } from "node:fs";
import { ExchangeClient, HttpTransport } from "@nktkas/hyperliquid";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { createHlInfo, getAccount, listMarkets } from "shared";

const envPath = new URL("../.env", import.meta.url).pathname;

function secret(name: string): `0x${string}` {
  const existing = process.env[name];
  if (existing) return existing as `0x${string}`;
  const key = generatePrivateKey();
  appendFileSync(envPath, `\n${name}=${key}\n`);
  process.env[name] = key;
  return key;
}

const transport = new HttpTransport({ isTestnet: true });
const info = createHlInfo("testnet");
const mainKey = process.env.MAIN_PRIVATE_KEY ?? "";
const main = privateKeyToAccount((mainKey.startsWith("0x") ? mainKey : `0x${mainKey}`) as `0x${string}`);
const agent = privateKeyToAccount(secret("HL_TESTNET_AGENT_KEY"));
const builder = process.env.HL_TESTNET_BUILDER as `0x${string}` | undefined;

console.log("main wallet", main.address);
console.log("agent wallet", agent.address);

const account = await getAccount(info, main.address);
console.log("equity", account.equity, "positions", account.positions.length);

const mainClient = new ExchangeClient({ transport, wallet: main });
const agentClient = new ExchangeClient({ transport, wallet: agent });

async function step(name: string, run: () => Promise<unknown>) {
  try {
    console.log(name, "OK", JSON.stringify(await run()));
  } catch (error) {
    console.log(name, "FAIL", String(error).slice(0, 300));
  }
}

await step("approveAgent", () =>
  mainClient.approveAgent({ agentAddress: agent.address, agentName: "opencash-test" }),
);

if (builder) {
  await step("approveBuilderFee", () =>
    mainClient.approveBuilderFee({ builder, maxFeeRate: "0.05%" }),
  );
}

const market = (await listMarkets(info, "")).find((m) => m.name === "BTC");
if (!market) throw new Error("BTC market not found");
const price = Number((market.markPx * 0.9).toPrecision(5));
const size = Number((20 / price).toFixed(market.szDecimals));

await step("agent updateLeverage", () =>
  agentClient.updateLeverage({ asset: market.assetId, isCross: true, leverage: 3 }),
);

await step("agent order (resting, post-only)", () =>
  agentClient.order({
    orders: [
      {
        a: market.assetId,
        b: true,
        p: String(price),
        s: String(size),
        r: false,
        t: { limit: { tif: "Alo" } },
      },
    ],
    grouping: "na",
    ...(builder ? { builder: { b: builder, f: 30 } } : {}),
  }),
);

await step("agent withdraw3 (must be refused)", () =>
  (agentClient as any).withdraw3({ destination: agent.address, amount: "1" }),
);
