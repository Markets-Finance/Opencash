import assert from "node:assert/strict";
import { OrderType } from "./orders.js";
import { liquidationPriceFor, tradeOverlay } from "./overlay.js";

const long = { positionType: OrderType.OpenLong, deposit: 50, entryPrice: 100, lots: 1, pnl: 0 } as never;
const liq = liquidationPriceFor(long, 20)!;
assert.ok(Math.abs(liq - 50 / 0.95) < 1e-9, "long liquidation");
const lines = tradeOverlay(long, 20, [{ stopLossPct: 10, takeProfitPct: 20 }]);
assert.deepEqual(lines.map((l) => l.title), ["Long entry", "Liquidation", "Stop", "Target"]);
assert.ok(Math.abs(lines[2].price - 95) < 1e-9 && Math.abs(lines[3].price - 110) < 1e-9, "2x leverage: 10% of margin is 5% of price");
const short = { ...(long as object), positionType: OrderType.OpenShort } as never;
const sl = tradeOverlay(short, null, [{ stopLossPct: 10 }]);
assert.deepEqual(sl.map((l) => l.title), ["Short entry", "Stop"]);
assert.ok(Math.abs(sl[1].price - 105) < 1e-9, "short stop is above entry");
console.log("overlay: ok");
