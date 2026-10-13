import { pulseList } from "../nansen";
import { botActionMessage, botDigest, botMandateMessage, type BotAction } from "shared";
import { network } from "../../../data/network";
import { createBot, createBotRuntime, type Bot, type BotMode, type BotRuntime } from "../../perpl";
import { terminal } from "../../perpl";
import { query } from "../dom";
import { toolbox } from "../agent/session";
import { requireTrader } from "../state";
import { publishStrategy } from "../strategies";
import { initLiveBots, paintLiveBots, startLiveBots } from "../lab/live";
import { localBotStorage } from "./storage";
import { renderBot } from "./view";

let runtime: BotRuntime | null = null;
let localBots: Bot[] = [];
let serverBots: Bot[] = [];
let serverTimer: ReturnType<typeof setInterval> | null = null;

const backend = import.meta.env.PUBLIC_BACKEND_URL ?? "http://localhost:8787";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${backend}${path}`, init);
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function paintAll() {
  const list = query("[data-bot-list]");
  const html = [...serverBots.map((bot) => renderBot(bot, true)), ...localBots.map((bot) => renderBot(bot))];
  list.innerHTML = html.length === 0 ? `<p class="empty">No bots yet.</p>` : html.join("");
}

function paint(bots: Bot[]) {
  localBots = bots;
  paintAll();
}

async function refreshServerBots() {
  try {
    const trader = requireTrader();
    const reply = await call<{ bots: Bot[] }>(`/bots?owner=${trader.address}&network=${network}`);
    serverBots = reply.bots;
  } catch {
    serverBots = [];
  }
  paintAll();
}

async function actServerBot(id: string, action: BotAction) {
  const issuedAt = Date.now();
  const signature = await requireTrader().account.signMessage({ message: botActionMessage(id, action, issuedAt) });
  await post(`/bots/${id}/${action}`, { issuedAt, signature });
  await refreshServerBots();
}

export async function startBots() {
  if (runtime) return;
  startLiveBots();
  const trader = requireTrader();
  runtime = createBotRuntime({
    terminal,
    toolbox,
    trader,
    storage: localBotStorage(trader.address),
    onChange: paint,
    smartPulses: pulseList,
  });
  await runtime.init();
  runtime.start();
  await refreshServerBots();
  serverTimer ??= setInterval(() => void refreshServerBots(), 15_000);
}

export async function addBotFromCard(card: Bot["card"], mode: BotMode) {
  const trader = requireTrader();
  const issuedAt = Date.now();
  const signature = await trader.account.signMessage({ message: botMandateMessage(trader.address, network, botDigest(card, mode), issuedAt) });
  await post("/bots", { owner: trader.address, network, mode, card, issuedAt, signature });
  await refreshServerBots();
}

export function exitsFor(symbol: string) {
  return [...serverBots, ...(runtime?.list() ?? [])]
    .filter((bot) => bot.status === "open" && bot.card.legs.some((leg) => leg.symbol === symbol))
    .map((bot) => ({ stopLossPct: bot.card.stopLossPct, takeProfitPct: bot.card.takeProfitPct }));
}

export function initBots() {
  const list = query("[data-bot-list]");
  const hint = () => query("[data-bot-hint]");
  initLiveBots(
    (error) => {
      hint().dataset.tone = "error";
      hint().textContent = error instanceof Error ? error.message : String(error);
    },
    (text) => {
      hint().dataset.tone = "";
      hint().textContent = text;
    },
  );
  document.addEventListener("live:changed", () => void paintLiveBots());

  list.addEventListener("click", async (event) => {
    const root = (event.target as HTMLElement).closest<HTMLElement>("[data-bot]");
    if (!root) return;
    const remote = serverBots.find((b) => b.id === root.dataset.bot);
    const bot = remote ?? runtime?.list().find((b) => b.id === root.dataset.bot);
    if (!bot) return;
    const failed = (error: unknown) => {
      const note = query("[data-bot-hint]");
      note.dataset.tone = "error";
      note.textContent = error instanceof Error ? error.message : String(error);
    };
    if ((event.target as HTMLElement).closest("[data-bot-toggle]")) {
      if (remote) await actServerBot(bot.id, bot.enabled ? "disable" : "enable").catch(failed);
      else await runtime?.setEnabled(bot.id, !bot.enabled);
    }
    if ((event.target as HTMLElement).closest("[data-bot-delete]")) {
      if (remote) await actServerBot(bot.id, "remove").catch(failed);
      else await runtime?.remove(bot.id);
    }
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
