import { terminal } from "../perpl";
import { autoFundOn } from "./autoFund";
import { session } from "./state";
import { showToast } from "./toast";

const checkMs = 30_000;
const retryMs = 300_000;

export function startSweep() {
  let busy = false;
  let pausedUntil = 0;

  async function tick() {
    const trader = session.trader;
    if (!trader || busy || Date.now() < pausedUntil) return;
    busy = true;
    try {
      const done = await terminal.sweepUsdc(trader, () => {});
      if (done) document.dispatchEvent(new CustomEvent("balance:changed"));
      if (autoFundOn()) {
        const moved = await terminal.sweepToPerpl(trader, () => {});
        if (moved) {
          document.dispatchEvent(new CustomEvent("balance:changed"));
          showToast(`Moved $${moved.amount.toFixed(2)} AUSD into Perpl, ready to trade.`);
        }
      }
    } catch {
      pausedUntil = Date.now() + retryMs;
    } finally {
      busy = false;
    }
  }

  void tick();
  setInterval(() => void tick(), checkMs);
}
