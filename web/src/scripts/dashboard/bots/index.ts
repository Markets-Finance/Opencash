import { createBot, createBotRuntime, ruleDrafter, type Bot, type BotMode, type BotRuntime } from "../../perpl";
import { terminal } from "../../perpl";
import { esc, query } from "../dom";
import { toolbox } from "../agent/session";
import { requireTrader } from "../state";
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

export function initBots() {
  const hint = query("[data-bot-hint]");
  const input = query<HTMLInputElement>("[data-bot-input]");
  const mode = query<HTMLSelectElement>("[data-bot-mode]");
  const list = query("[data-bot-list]");

  query<HTMLFormElement>("[data-bot-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    hint.textContent = "";
    hint.dataset.tone = "";
    try {
      const symbols = (await toolbox.getMarkets()).map((m) => m.symbol);
      const card = await ruleDrafter(input.value, symbols);
      if (card === null || !runtime) {
        hint.dataset.tone = "error";
        hint.textContent = `Name a market and a side, for example "long MON short BTC 2x $100 stop 8%". Markets: ${symbols.map(esc).join(", ")}.`;
        return;
      }
      await runtime.add(createBot(card.name, mode.value as BotMode, card, Date.now()));
      input.value = "";
    } catch (error) {
      hint.dataset.tone = "error";
      hint.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  list.addEventListener("click", async (event) => {
    const root = (event.target as HTMLElement).closest<HTMLElement>("[data-bot]");
    if (!root || !runtime) return;
    const bot = runtime.list().find((b) => b.id === root.dataset.bot);
    if (!bot) return;
    if ((event.target as HTMLElement).closest("[data-bot-toggle]")) await runtime.setEnabled(bot.id, !bot.enabled);
    if ((event.target as HTMLElement).closest("[data-bot-delete]")) await runtime.remove(bot.id);
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
