import { allocate } from "./weights.js";
import { customBin } from "./custom.js";
import { sizeBin } from "./sizing.js";
import type { PerpMarket } from "../perpl/markets.js";

const legs = [
  { symbol: "BTC", direction: "long" as const, weightBps: 5000, leverage: 3 },
  { symbol: "ETH", direction: "long" as const, weightBps: 3000, leverage: 3 },
  { symbol: "SOL", direction: "short" as const, weightBps: 2000, leverage: 3 },
];
const inputs = new Map([
  ["BTC", { depthUsd: 1_000_000, volPct: 40 }],
  ["ETH", { depthUsd: 500_000, volPct: 60 }],
  ["SOL", { depthUsd: 250_000, volPct: 80 }],
]);
const sum = (weights: { weightBps: number }[]) => weights.reduce((total, leg) => total + leg.weightBps, 0);

const liquidity = allocate(legs, "liquidity", inputs);
console.assert(sum(liquidity.legs) === 10000, "liquidity sums to 10000");
console.assert(liquidity.legs[0].weightBps === 5714 || liquidity.legs[0].weightBps === 5715, "BTC ~57.1%", liquidity.legs[0].weightBps);
const risk = allocate(legs, "risk", inputs);
console.assert(sum(risk.legs) === 10000 && risk.legs[0].weightBps > risk.legs[2].weightBps, "risk favours calm legs");
const equal = allocate(legs, "equal", new Map());
console.assert(sum(equal.legs) === 10000 && equal.legs[0].weightBps === 3334, "equal remainder goes first", equal.legs.map((l) => l.weightBps));
const fallback = allocate(legs, "liquidity", new Map());
console.assert(fallback.usedMode === "fixed", "missing inputs fall back to fixed");
console.assert(customBin([{ symbol: "BTC", direction: "long" }, { symbol: "ETH", direction: "short" }], "liquidity", 2).legs.length === 2, "custom bin");

const market = (symbol: string, mark: number) =>
  [symbol, { symbol, perpId: 1, mark, lotDecimals: 3, numOrders: 5 } as unknown as PerpMarket] as const;
const markets = new Map([market("BTC", 100), market("ETH", 100), market("SOL", 100)]);
const capped = sizeBin({ id: "t", name: "t", thesis: "", legs }, 10_000, markets, new Map(), new Map([["SOL", 1000]]));
const sol = capped.sized.legs.find((leg) => leg.leg.symbol === "SOL")!;
console.assert(sol.notional <= 1000 && capped.issues.some((issue) => issue.reason === "depth-limited"), "SOL depth capped", sol.notional);
console.assert(sol.margin <= 1000 / 3 + 1e-9, "margin follows the capped notional", sol.margin);
console.log("ok", liquidity.legs.map((l) => l.weightBps), risk.legs.map((l) => l.weightBps));
