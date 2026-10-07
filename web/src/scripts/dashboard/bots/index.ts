import { createBot, createBotRuntime, type Bot, type BotMode, type BotRuntime } from "../../perpl";
import { terminal } from "../../perpl";
import { query } from "../dom";
import { toolbox } from "../agent/session";
import { requireTrader } from "../state";
import { publishStrategy } from "../strategies";
import { localBotStorage } from "./storage";
import { renderBot } from "./view";

let runtime: BotRuntime | null = null;

function paint(bots: Bot[]) {
  const list = query("[data-bot-list]");
  list.innerHTML = bots.length === 0 ? `<p class="empty">No bots yet.</p>` : bots.map(renderBot).join("");
}

export async function startBots() {
  if (runtime) return;
  const trader = requireTrader();
  runtime = createBotRuntime({
    terminal,
    toolbox,
    trader,
    storage: localBotStorage(trader.address),
    onChange: paint,
  });
  await runtime.init();
  runtime.start();
}

export async function addBotFromCard(card: Bot["card"], mode: BotMode) {
  if (!runtime) throw new Error("Bots are not running yet");
  await runtime.add(createBot(card.name, mode, card, Date.now()));
}

export function initBots() {
  const list = query("[data-bot-list]");

  list.addEventListener("click", async (event) => {
    const root = (event.target as HTMLElement).closest<HTMLElement>("[data-bot]");
    if (!root || !runtime) return;
    const bot = runtime.list().find((b) => b.id === root.dataset.bot);
    if (!bot) return;
    if ((event.target as HTMLElement).closest("[data-bot-toggle]")) await runtime.setEnabled(bot.id, !bot.enabled);
    if ((event.target as HTMLElement).closest("[data-bot-delete]")) await runtime.remove(bot.id);
    if ((event.target as HTMLElement).closest("[data-bot-share]")) {
      const hint = query("[data-bot-hint]");
      try {
        const shared = await publishStrategy(bot.card);
        hint.dataset.tone = "";
        hint.textContent = `Shared as strategy ${shared.id}. It appears on Ranks and ranks once two followers have closed trades.`;
      } catch (error) {
        hint.dataset.tone = "error";
        hint.textContent = error instanceof Error ? error.message : String(error);
      }
    }
  });

  list.addEventListener("change", async (event) => {
    const field = event.target as HTMLInputElement;
    const rule = field.dataset.rule;
    const root = field.closest<HTMLElement>("[data-bot]");
    if (!rule || !root || !runtime) return;
    await runtime.update(root.dataset.bot!, (bot) => ({
      ...bot,
      rules: { ...bot.rules, [rule]: Number(field.value) },
    }));
  });

}
