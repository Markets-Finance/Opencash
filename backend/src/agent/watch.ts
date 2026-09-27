import { getMandate } from "./mandates.js";
import { proposeAction } from "./propose.js";
import { executeProposal } from "./execute.js";

const timers = new Map<string, ReturnType<typeof setInterval>>();
const inFlight = new Set<string>();

export function isWatching(mandateId: string): boolean {
  return timers.has(mandateId);
}

export function startWatch(mandateId: string, intervalMs: number): void {
  if (timers.has(mandateId)) return;

  const timer = setInterval(async () => {
    // A tick can outlive intervalMs; overlapping ticks would each propose and
    // each spend the full budget, since usdgBudget clamps per proposal.
    if (inFlight.has(mandateId)) return;

    const mandate = await getMandate(mandateId);
    if (!mandate) {
      stopWatch(mandateId);
      return;
    }

    inFlight.add(mandateId);
    try {
      const proposal = await proposeAction(mandateId);
      // autoExecute defaults to false: a mandate must opt in before this loop
      // is allowed to sign and submit a real transaction on its own.
      if (mandate.autoExecute) {
        await executeProposal(proposal.id);
      }
    } catch (error) {
      console.error(`watch ${mandateId} tick failed`, error);
    } finally {
      inFlight.delete(mandateId);
    }
  }, intervalMs);

  timers.set(mandateId, timer);
}

export function stopWatch(mandateId: string): void {
  const timer = timers.get(mandateId);
  if (!timer) return;
  clearInterval(timer);
  timers.delete(mandateId);
  inFlight.delete(mandateId);
}
