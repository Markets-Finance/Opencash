import assert from "node:assert/strict";
import type { PerpMarket } from "../perpl/markets.js";
import { bins } from "./catalog.js";
import { sizeBin } from "./sizing.js";

const symbols = ["BTC", "ETH", "SOL", "MON", "HYPE", "ZEC", "LIT", "VVV", "PUMP", "NEAR", "UNI"];
const markets = new Map(symbols.map((symbol) => [symbol, { symbol, perpId: 1, mark: 10, lotDecimals: 3, numOrders: 5 } as unknown as PerpMarket]));

for (const bin of bins) {
  assert.equal(bin.legs.reduce((sum, leg) => sum + leg.weightBps, 0), 10000, `${bin.id} weights sum to 100%`);
  const { sized, issues } = sizeBin(bin, 100, markets, new Map());
  assert.equal(issues.length, 0, `${bin.id} sizes cleanly`);
  assert.ok(Math.abs(sized.legs.reduce((sum, leg) => sum + leg.margin, 0) - 100) < 0.1, `${bin.id} margin adds up`);
  for (const leg of sized.legs) {
    const expected = (100 * leg.leg.weightBps) / 10000;
    assert.ok(Math.abs(leg.margin - expected) < 0.5, `${bin.id} ${leg.leg.symbol} gets its share`);
  }
}
console.log(`bins: ${bins.length} bins ok`);
