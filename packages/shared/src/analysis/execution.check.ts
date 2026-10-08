import { estimateExecution, maxNotionalWithinBps, slippageBps } from "./market.js";

const book = {
  atMs: 0,
  bids: [{ price: 99.9, size: 10, orders: 1 }, { price: 99.5, size: 100, orders: 1 }],
  asks: [{ price: 100.1, size: 10, orders: 1 }, { price: 100.5, size: 100, orders: 1 }],
};
const mid = 100;
const small = slippageBps(book, "buy", 500, mid);
const big = slippageBps(book, "buy", 5000, mid);
const cap = maxNotionalWithinBps(book, "buy", 25, mid);
const estimate = estimateExecution({ book, side: "buy", notionalUsd: 5000, takerFeeBps: 3.45, fundingAprPct: 36.5 });

console.assert(small !== null && Math.abs(small - 10) < 1e-6, "inside first level costs half spread", small);
console.assert(big !== null && big > 10 && big < 50, "walks into second level", big);
console.assert(slippageBps(book, "buy", 1e9, mid) === null, "beyond the book is null");
console.assert(cap > 1000 && cap < 5000, "cap between levels", cap);
console.assert(estimate !== null && Math.abs(estimate.feeUsd - 1.725) < 1e-9, "taker fee", estimate?.feeUsd);
console.assert(estimate !== null && Math.abs(estimate.fundingDailyUsd - 5) < 1e-9, "long pays 36.5% apr = 0.1%/day", estimate?.fundingDailyUsd);
console.log({ small, big, cap, grade: estimate?.grade });
