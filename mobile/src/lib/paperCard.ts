import AsyncStorage from "@react-native-async-storage/async-storage";
import { createBot, paperExit, paperPnl, type Bot, type BotMode } from "shared";
import { toolbox } from "./bots";

export type PaperBot = Bot & { paper: true; entries: Record<string, number>; unrealisedUsd: number };

const checkMs = 15_000;
let bots: PaperBot[] = [];
let owner = "";
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(bots: PaperBot[]) => void>();

const keyFor = (address: string) => `opencash.paperbots.${address.toLowerCase()}`;

function commit(next: PaperBot[]) {
  bots = next;
  void AsyncStorage.setItem(keyFor(owner), JSON.stringify(bots)).catch(() => {});
  listeners.forEach((listener) => listener(bots));
}

export function subscribePaperCards(listener: (bots: PaperBot[]) => void): () => void {
  listeners.add(listener);
  listener(bots);
  return () => {
    listeners.delete(listener);
  };
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

async function tick() {
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
    commit([...bots]);
  } catch {
    return;
  }
}

export async function startPaperCards(address: string): Promise<void> {
  stopPaperCards();
  owner = address;
  try {
    bots = JSON.parse((await AsyncStorage.getItem(keyFor(owner))) ?? "[]") as PaperBot[];
  } catch {
    bots = [];
  }
  listeners.forEach((listener) => listener(bots));
  void tick();
  timer = setInterval(() => void tick(), checkMs);
}

export function stopPaperCards(): void {
  if (timer !== null) clearInterval(timer);
  timer = null;
  bots = [];
  listeners.forEach((listener) => listener(bots));
}

export async function addPaperCard(card: Bot["card"], mode: BotMode): Promise<string> {
  const bot: PaperBot = { ...createBot(card.name, mode, card, Date.now()), paper: true, entries: {}, unrealisedUsd: 0 };
  await openBot(bot);
  commit([bot, ...bots]);
  return bot.id;
}

export async function togglePaperCard(id: string): Promise<void> {
  const bot = bots.find((entry) => entry.id === id);
  if (!bot) return;
  if (bot.enabled) closeBot(bot, "Stopped by you", bot.unrealisedUsd);
  else await openBot(bot);
  commit([...bots]);
}

export function removePaperCard(id: string): void {
  commit(bots.filter((entry) => entry.id !== id));
}
