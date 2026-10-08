import { readFileSync } from "node:fs";
import { aggregate, type LedgerEvent } from "shared";
import { ingest, orderEvents, summarise, type AccountAgg } from "./accounts.js";

const saved = JSON.parse(readFileSync("data/analytics-mainnet.json", "utf8")) as { events: LedgerEvent[] };
const reference = new Map(aggregate(saved.events).map((s) => [s.accountId, s]));
const accounts: Record<number, AccountAgg> = {};
for (const event of orderEvents(saved.events)) ingest(accounts, event, 0.4);

let bad = 0;
let checked = 0;
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
for (const [id, agg] of Object.entries(accounts)) {
  const mine = summarise(agg);
  const ref = reference.get(Number(id));
  if (!ref) continue;
  checked += 1;
  const pairs: [string, number, number][] = [
    ["net", mine.netPnlUsd, ref.netPnlUsd],
    ["volume", mine.volumeUsd, ref.volumeUsd],
    ["closed", mine.closedTrades, ref.closedTrades],
    ["wins", mine.wins, ref.wins],
    ["winRate", mine.winRate, ref.winRate],
    ["dd", mine.maxDrawdownUsd, ref.maxDrawdownUsd],
    ["liq", mine.liquidations, ref.liquidations],
  ];
  for (const [name, a, b] of pairs) {
    if (!near(a, b)) {
      bad += 1;
      if (bad < 8) console.log("MISMATCH", id, name, a, b);
    }
  }
  if ((mine.profitFactor === null) !== (ref.profitFactor === null) || (mine.profitFactor !== null && !near(mine.profitFactor, ref.profitFactor!))) {
    bad += 1;
    if (bad < 8) console.log("MISMATCH", id, "pf", mine.profitFactor, ref.profitFactor);
  }
}
const withHolds = Object.values(accounts).filter((a) => a.holds > 0).length;
console.log({ accounts: Object.keys(accounts).length, checked, mismatches: bad, withHolds });
