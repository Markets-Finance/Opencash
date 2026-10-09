import { binAgreement, pulseFromRows } from "./pulse.js";

const row = (token_symbol: string, chain: string, d7: number, d24: number, traders: number) => ({
  token_symbol,
  chain,
  net_flow_1h_usd: 0,
  net_flow_24h_usd: d24,
  net_flow_7d_usd: d7,
  net_flow_30d_usd: d7 * 2,
  trader_count: traders,
});
const rows = [row("WETH", "ethereum", 500_000, 100_000, 30), row("ETH", "base", 200_000, 0, 10), row("WBTC", "ethereum", -900_000, -50_000, 20), row("MON", "monad", 4_000, 1_000, 3)];
const pulses = pulseFromRows(["ETH", "BTC", "MON", "ZEC"], rows);
const get = (symbol: string) => pulses.find((pulse) => pulse.symbol === symbol)!;

console.assert(get("ETH").flow7dUsd === 700_000 && get("ETH").traders === 40 && get("ETH").stance === "buying", "ETH aliases sum", get("ETH"));
console.assert(get("BTC").stance === "selling", "BTC selling", get("BTC"));
console.assert(get("MON").stance === "flat", "MON under the flat band", get("MON"));
console.assert(get("ZEC").tokens.length === 0, "ZEC unknown");

const agreement = binAgreement(
  [
    { symbol: "ETH", direction: "long", weightBps: 5000 },
    { symbol: "BTC", direction: "short", weightBps: 3000 },
    { symbol: "ZEC", direction: "long", weightBps: 2000 },
  ],
  pulses,
);
console.assert(agreement.agree === 2 && agreement.unknown === 1 && agreement.against === 0, "two legs agree, one unknown", agreement);
console.assert(agreement.label === "Smart money backs 2 of 2 legs · 1 without data", agreement.label);
console.assert(Math.abs(agreement.netUsd - (700_000 * 0.5 + 900_000 * 0.3)) < 1e-6, "weighted net", agreement.netUsd);
console.log("ok", agreement.label);
