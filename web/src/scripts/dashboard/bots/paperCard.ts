import { paperExit, paperPnl } from "shared";
import { createBot, type Bot, type BotMode } from "../../perpl";
import { toolbox } from "../agent/session";
import { session } from "../state";

export type PaperBot = Bot & { paper: true; entries: Record<string, number>; unrealisedUsd: number };

const checkMs = 15_000;
let bots: PaperBot[] = [];
let owner = "";
let timer: ReturnType<typeof setInterval> | null = null;

const keyFor = (address: string) => `opencash.paperbots.${address.toLowerCase()}`;

function save() {
  try {
    localStorage.setItem(keyFor(owner), JSON.stringify(bots));
  } catch {}
  document.dispatchEvent(new CustomEvent("paperbots:changed"));
}

function log(bot: PaperBot, level: "info" | "action" | "error", message: string) {
  bot.log = [{ at: Date.now(), level, message }, ...bot.log].slice(0, 60);
}

async function marks(symbols: string[]): Promise<Record<string, number>> {
  const [markets, tickers] = await Promise.all([toolbox.getMarkets(), toolbox.getTickers()]);
  const found: Record<string, number> = {};
  for (const symbol of symbols) {
    const market = markets.find((entry) => entry.symbol === symbol);
    const ticker = market ? tickers.get(market.id) : undefined;
    if (ticker) found[symbol] = ticker.mark;
  }
  return found;
}

async function openBot(bot: PaperBot) {
  const prices = await marks(bot.card.legs.map((leg) => leg.symbol));
  const missing = bot.card.legs.filter((leg) => !prices[leg.symbol]);
  if (missing.length > 0) throw new Error(`No live price for ${missing.map((leg) => leg.symbol).join(", ")}`);
  bot.entries = prices;
  bot.unrealisedUsd = 0;
  bot.status = "open";
  bot.enabled = true;
  bot.lastOpenAt = Date.now();
  log(bot, "action", `Paper opened ${bot.card.legs.map((leg) => `${leg.direction} ${leg.symbol} at ${prices[leg.symbol]}`).join(", ")} with fake $${bot.card.marginUsd}`);
}

function closeBot(bot: PaperBot, why: string, pnl: number) {
  bot.realizedPnlUsd += pnl;
  bot.unrealisedUsd = 0;
  bot.status = "stopped";
  bot.enabled = false;
  log(bot, "action", `${why}. Paper result ${pnl >= 0 ? "+" : "−"}$${Math.abs(pnl).toFixed(2)}`);
}

export async function tickPaper(): Promise<void> {
  const active = bots.filter((bot) => bot.enabled && bot.status === "open");
  if (active.length === 0) return;
  try {
    const prices = await marks([...new Set(active.flatMap((bot) => bot.card.legs.map((leg) => leg.symbol)))]);
    for (const bot of active) {
      const pnl = paperPnl(bot.card, bot.entries, prices);
      bot.unrealisedUsd = pnl;
      bot.lastCheck = { at: Date.now(), message: `Paper P&L ${pnl >= 0 ? "+" : "−"}$${Math.abs(pnl).toFixed(2)}` };
      const exit = paperExit(bot.card, pnl);
      if (exit === "stop") closeBot(bot, `Stop hit at −${bot.card.stopLossPct}%`, pnl);
      else if (exit === "target") closeBot(bot, `Target hit at +${bot.card.takeProfitPct}%`, pnl);
    }
    save();
  } catch {
    return;
  }
}

export function startPaper() {
  const trader = session.trader;
  if (!trader || timer) return;
  owner = trader.address;
  try {
    bots = JSON.parse(localStorage.getItem(keyFor(owner)) ?? "[]") as PaperBot[];
  } catch {
    bots = [];
  }
  document.dispatchEvent(new CustomEvent("paperbots:changed"));
  void tickPaper();
  timer = setInterval(() => void tickPaper(), checkMs);
}

export const listPaper = (): PaperBot[] => bots;

export async function addPaper(card: Bot["card"], mode: BotMode): Promise<void> {
  const bot = { ...createBot(card.name, mode, card, Date.now()), paper: true as const, entries: {}, unrealisedUsd: 0 } satisfies PaperBot;
  await openBot(bot);
  bots = [bot, ...bots];
  save();
}

export async function togglePaper(id: string): Promise<void> {
  const bot = bots.find((entry) => entry.id === id);
  if (!bot) return;
  if (bot.enabled) {
    const pnl = bot.unrealisedUsd;
    closeBot(bot, "Stopped by you", pnl);
  } else {
    await openBot(bot);
  }
  save();
}

export function removePaper(id: string): void {
  bots = bots.filter((entry) => entry.id !== id);
  save();
}
