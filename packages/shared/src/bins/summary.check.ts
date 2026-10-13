import assert from "node:assert/strict";
import type { PerpMarket } from "../perpl/markets.js";
import { OrderType } from "../perpl/orders.js";
import { binSeries, binView } from "./summary.js";
import type { BinPosition } from "./position.js";

const market = (symbol: string) => [symbol, { symbol, lotDecimals: 3 } as unknown as PerpMarket] as const;
const leg = (symbol: string, type: number, deposit: number, entryPrice: number, lots: number, mark: number, pnl: number) => ({
  symbol,
  position: { perpId: 1, positionType: type, deposit, entryPrice, lots, entryBlock: 0n, pnl, mark, markValid: true },
});
const position = { bin: { id: "t", name: "t", thesis: "", legs: [] }, deposit: 30, pnl: 0, legs: [leg("A", OrderType.OpenLong, 20, 100, 400, 110, 4), leg("B", OrderType.OpenShort, 10, 50, 400, 55, -2)] } as unknown as BinPosition;
const view = binView(position, new Map([market("A"), market("B")]));
assert.equal(view.margin, 30);
assert.equal(view.legs[0]!.units, 0.4);
assert.equal(view.legs[1]!.direction, "short");
assert.ok(Math.abs(view.legs[0]!.allocationPct - 66.6667) < 1e-3);
assert.equal(view.pnl, 2);
const series = binSeries(view, new Map([["A", [{ time: 1, close: 100 }, { time: 2, close: 110 }]], ["B", [{ time: 1, close: 50 }, { time: 2, close: 55 }]]]));
assert.deepEqual(series.map((point) => point.time), [1, 2]);
assert.ok(Math.abs(series[0]!.value) < 1e-9);
assert.ok(Math.abs(series[1]!.value - (0.4 * 10 - 0.4 * 5)) < 1e-9);
console.log("bin summary: ok");
