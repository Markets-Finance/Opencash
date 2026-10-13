import type { TradingAccount } from "shared";
import { terminal } from "./perpl";

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
    } catch {
      pausedUntil = Date.now() + retryMs;
    } finally {
      busy = false;
    }
  }

  void tick();
  timer = setInterval(() => void tick(), checkMs);
}

export function stopSweep(): void {
  if (timer !== null) clearInterval(timer);
  timer = null;
}
