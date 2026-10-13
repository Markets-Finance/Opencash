import { pulseList } from "../nansen";
import { botActionMessage, botDigest, botMandateMessage, type BotAction } from "shared";
import { network } from "../../../data/network";
import { createBot, createBotRuntime, type Bot, type BotMode, type BotRuntime } from "../../perpl";
import { terminal } from "../../perpl";
import { query } from "../dom";
import { toolbox } from "../agent/session";
import { requireTrader, session } from "../state";
import { initLiveBots, paintLiveBots, startLiveBots, turnOnServerRunning } from "../lab/live";
import { addPaper, listPaper, removePaper, startPaper, togglePaper } from "./paperCard";
import { localBotStorage } from "./storage";
import { initTradeStrip } from "./tradeStrip";
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
  const paper = listPaper();
  const html = [...serverBots.map((bot) => renderBot(bot, "live")), ...paper.map((bot) => renderBot(bot, "paper")), ...localBots.map((bot) => renderBot(bot, "browser"))];
  list.innerHTML = html.length === 0 ? `<p class="empty">No bots yet. Ask the agent for a trade, then start it in Paper or Live.</p>` : html.join("");
  document.dispatchEvent(new CustomEvent("bots:changed", { detail: [...serverBots.map((bot) => ({ bot, kind: "live" })), ...paper.map((bot) => ({ bot, kind: "paper" }))] }));
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
  startPaper();
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

export async function addBotFromCard(card: Bot["card"], mode: BotMode): Promise<string> {
  const trader = requireTrader();
  const issuedAt = Date.now();
  const signature = await trader.account.signMessage({ message: botMandateMessage(trader.address, network, botDigest(card, mode), issuedAt) });
  const created = await post<{ id: string }>("/bots", { owner: trader.address, network, mode, card, issuedAt, signature });
  await refreshServerBots();
  return created.id;
}

export async function startFromCard(card: Bot["card"], mode: BotMode, kind: "paper" | "live", onStep: (text: string) => void): Promise<string> {
  if (kind === "paper") {
    await addPaper(card, mode);
    return "Paper bot is running with fake money. Watch it under Your bots.";
  }
  const trader = requireTrader();
  const account = await terminal.loadAccount(trader.address).catch(() => null);
  const free = account === null ? 0 : account.balance - account.lockedBalance;
  if (free < botMinUsd) throw new Error(`A live bot trades from your Perpl account and needs at least $${botMinUsd} there. You have $${free.toFixed(2)}. Move AUSD in from Account, Move between wallet and Perpl, or test it in Paper first.`);
  if (card.marginUsd > free) throw new Error(`This bot wants $${card.marginUsd} margin but Perpl has $${free.toFixed(2)} free. Lower the margin.`);
  const status = await call<{ hasKey: boolean }>(`/bots?owner=${trader.address}&network=${network}`);
  if (!status.hasKey) await turnOnServerRunning(onStep);
  onStep("Approve the bot with your passkey…");
  const id = await addBotFromCard(card, mode);
  onStep("Starting it…");
  await actServerBot(id, "enable");
  return "Live bot started. It trades from the server, even when this page is closed.";
}

export function exitsFor(symbol: string) {
  return [...serverBots, ...(runtime?.list() ?? [])]
    .filter((bot) => bot.status === "open" && bot.card.legs.some((leg) => leg.symbol === symbol))
    .map((bot) => ({ stopLossPct: bot.card.stopLossPct, takeProfitPct: bot.card.takeProfitPct }));
}

const botMinUsd = 10;

async function paintFundingNote() {
  const note = document.querySelector<HTMLElement>("[data-bots-note]");
  const trader = session.trader;
  if (!note || !trader) return;
  const [account, wallet] = await Promise.all([terminal.loadAccount(trader.address).catch(() => null), terminal.loadCollateralBalance(trader.address).catch(() => 0)]);
  const perpl = account === null ? 0 : account.balance - account.lockedBalance;
  note.hidden = perpl >= botMinUsd;
  if (wallet >= botMinUsd && perpl < botMinUsd) {
    note.textContent = `You have $${wallet.toFixed(2)} AUSD in your wallet but $${perpl.toFixed(2)} in Perpl. Bots trade from your Perpl account, so move at least $${botMinUsd} there first (Account, Move between wallet and Perpl).`;
  } else {
    note.textContent = `Deposit at least $${botMinUsd} before starting a bot. A bot skips any order under $${botMinUsd}, so it can't trade with less.`;
  }
}

export function initBots() {
  initTradeStrip();
  document.addEventListener("paperbots:changed", paintAll);
  document.addEventListener("balance:changed", () => void paintFundingNote());
  setTimeout(() => void paintFundingNote(), 1500);
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
    const paperBot = listPaper().find((b) => b.id === root.dataset.bot);
    const bot = remote ?? paperBot ?? runtime?.list().find((b) => b.id === root.dataset.bot);
    if (!bot) return;
    const failed = (error: unknown) => {
      const note = query("[data-bot-hint]");
      note.dataset.tone = "error";
      note.textContent = error instanceof Error ? error.message : String(error);
    };
    if ((event.target as HTMLElement).closest("[data-bot-toggle]")) {
      if (paperBot) await togglePaper(bot.id).catch(failed);
      else if (remote) await actServerBot(bot.id, bot.enabled ? "disable" : "enable").catch(failed);
      else await runtime?.setEnabled(bot.id, !bot.enabled);
    }
    if ((event.target as HTMLElement).closest("[data-bot-delete]")) {
      if (paperBot) removePaper(bot.id);
      else if (remote) await actServerBot(bot.id, "remove").catch(failed);
      else await runtime?.remove(bot.id);
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
