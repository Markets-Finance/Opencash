import type { TradingAccount } from "shared";
import { autoFundEnabled, loadAutoFund } from "./autoFund";
import { terminal } from "./perpl";
import { showToast } from "./toast";

const checkMs = 30_000;
const retryMs = 300_000;

let timer: ReturnType<typeof setInterval> | null = null;

export function startSweep(trader: TradingAccount, onSwept: () => void): void {
  stopSweep();
  let busy = false;
  let pausedUntil = 0;

  async function tick() {
    if (busy || Date.now() < pausedUntil) return;
    busy = true;
    try {
      const done = await terminal.sweepUsdc(trader, () => {});
      if (done) onSwept();
      if (autoFundEnabled()) {
        const moved = await terminal.sweepToPerpl(trader, () => {});
        if (moved) {
          onSwept();
          showToast(`Moved $${moved.amount.toFixed(2)} AUSD into Perpl, ready to trade.`);
        }
      }
    } catch {
      pausedUntil = Date.now() + retryMs;
    } finally {
      busy = false;
    }
  }

  void loadAutoFund().then(() => tick());
  timer = setInterval(() => void tick(), checkMs);
}

export function stopSweep(): void {
  if (timer !== null) clearInterval(timer);
  timer = null;
}
