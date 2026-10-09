import { terminal } from "../perpl";
import { session } from "./state";

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
    } catch {
      pausedUntil = Date.now() + retryMs;
    } finally {
      busy = false;
    }
  }

  void tick();
  setInterval(() => void tick(), checkMs);
}
