import assert from "node:assert/strict";
import { cardDots, ease, pairDots, pendingPercent, percentLabel, scatterDots, textDots, textWidth } from "./index.js";

assert.equal(percentLabel(4), "004%");
assert.equal(percentLabel(100), "100%");
assert.ok(pendingPercent(100000) <= 94 && pendingPercent(0) === 0, "pending stays under 100");
assert.equal(textDots("1", 10, 0, 0).length, 10);
assert.equal(textWidth(4, 10), 230);
assert.ok(scatterDots(400, 300, 6, 5).length > 20);
const card = cardDots(200, 150, 300, 6);
assert.ok(card.length > 80);
assert.equal(pairDots(textDots("094%", 6, 0, 0), card).length, Math.max(textDots("094%", 6, 0, 0).length, card.length));
assert.equal(ease(0), 0);
assert.equal(ease(1), 1);
console.log("dotmatrix: ok");
