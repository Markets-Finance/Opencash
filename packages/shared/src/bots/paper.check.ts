import assert from "node:assert/strict";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);
import { paperExit, paperPnl } from "./paper.js";

const card = { name: "t", thesis: "", kind: "pair" as const, marginUsd: 100, stopLossPct: 6, takeProfitPct: 10, legs: [{ symbol: "A", direction: "long" as const, weightBps: 5000, leverage: 2 }, { symbol: "B", direction: "short" as const, weightBps: 5000, leverage: 2 }] };
const entries = { A: 100, B: 100 };
near(paperPnl(card, entries, { A: 101, B: 100 }), 1);
near(paperPnl(card, entries, { A: 100, B: 99 }), 1);
assert.equal(paperExit(card, -6), "stop");
assert.equal(paperExit(card, 10), "target");
assert.equal(paperExit(card, 2), null);
near(paperPnl(card, entries, { A: 90, B: 110 }), -20);
console.log("paper: ok");
