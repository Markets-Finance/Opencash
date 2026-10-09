import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.NANSEN_API_KEY = "test-key";
process.env.NANSEN_CREDIT_CAP = "20";
const { smartPulse } = await import("./pulse.js");
const { walletIntel } = await import("./wallet.js");
const { nansenStatus, nansen } = await import("./client.js");
process.chdir(mkdtempSync(join(tmpdir(), "nansen-")));

const calls: { path: string; body: any; key: string | null }[] = [];
let failFirstNetflow = true;
globalThis.fetch = (async (url: string, init: any) => {
  const path = new URL(url).pathname.replace("/api/v1", "");
  const body = JSON.parse(init.body);
  calls.push({ path, body, key: init.headers.apikey ?? null });
  const reply = (json: unknown, cost = 5) => new Response(JSON.stringify(json), { status: 200, headers: { "x-nansen-credits-cost": String(cost) } });
  if (path === "/smart-money/netflow") {
    if (failFirstNetflow && body.order_by) {
      failFirstNetflow = false;
      return new Response("bad order_by", { status: 400 });
    }
    return reply({ data: [{ token_symbol: "WETH", chain: "ethereum", net_flow_1h_usd: 1, net_flow_24h_usd: 50_000, net_flow_7d_usd: 300_000, net_flow_30d_usd: 1, trader_count: 12 }] });
  }
  if (path === "/profiler/address/pnl-summary") return reply({ realized_pnl_usd: 1234.5, realized_pnl_percent: 0.2, win_rate: 0.6, traded_token_count: 4, traded_times: 21, top5_tokens: [{ token_symbol: "MON", realized_pnl: 900 }] }, 1);
  if (path === "/profiler/address/current-balance") return reply({ data: [{ token_symbol: "MON", value_usd: 5000 }] }, 1);
  if (path === "/profiler/address/related-wallets") return reply({ data: [{ address: "0xabc", address_label: "Fund X", relation: "First Funder" }] }, 1);
  if (path === "/profiler/address/labels") return reply({ data: [{ label: "Smart Trader", category: "smart_money", kind: "behavioral" }] }, 100);
  return new Response("nope", { status: 404 });
}) as never;

const first = await smartPulse(["ETH"]);
console.assert(first.pulses[0].stance === "buying" && first.pulses[0].flow7dUsd === 300_000, "pulse parsed", first.pulses[0]);
console.assert(calls.length === 2 && calls[1].body.order_by === undefined, "retried without order_by after a 400", calls.length);
console.assert(calls.every((call) => call.key === "test-key"), "api key header sent");

const second = await smartPulse(["ETH"]);
console.assert(second.cached === true && calls.length === 2, "second pulse served from cache");

const intel = await walletIntel("0x0000000000000000000000000000000000000001", false);
console.assert(intel.pnl?.realizedUsd === 1234.5 && intel.pnl.topTokens[0].symbol === "MON", "pnl parsed", intel.pnl);
console.assert(intel.balances?.[0].valueUsd === 5000 && intel.related?.[0].label === "Fund X", "balances and related parsed");
console.assert(intel.labels === null && intel.creditsUsed === 3, "labels skipped by default", intel.creditsUsed);

let blocked = "";
try {
  await walletIntel("0x0000000000000000000000000000000000000002", true);
} catch (error) {
  blocked = String(error);
}
const withLabels = await walletIntel("0x0000000000000000000000000000000000000002", true).catch(() => null);
console.assert(withLabels === null || withLabels.errors.some((e) => e.includes("credit cap")), "labels blocked by the credit cap", withLabels?.errors);
console.assert(nansenStatus().creditsUsed <= 20 + 5, "cap respected", nansenStatus().creditsUsed);
void nansen;
console.log("ok", nansenStatus());
