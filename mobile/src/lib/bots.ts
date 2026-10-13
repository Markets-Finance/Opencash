import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createBot,
  createBotRuntime,
  createToolbox,
  defaultLimits,
  perpl,
  ruleDrafter,
  type Bot,
  type BotMode,
  type BotRuntime,
  type TradingAccount,
  askAgent,
} from "shared";
import { backendUrl } from "./config";
import { startPaperCards, stopPaperCards } from "./paperCard";
import { pulseList } from "./nansen";
import { terminal } from "./perpl";
import { deployment, network } from "./network";

export const toolbox = createToolbox(perpl.createPerplApi(deployment.apiUrl), defaultLimits);
toolbox.setSmartMoney(pulseList);

let runtime: BotRuntime | null = null;
let owner: string | null = null;
let signer: TradingAccount | null = null;
let current: Bot[] = [];
const listeners = new Set<(bots: Bot[]) => void>();

function notify(bots: Bot[]) {
  current = bots;
  listeners.forEach((listener) => listener(bots));
}

export function subscribeBots(listener: (bots: Bot[]) => void): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export async function startBots(trader: TradingAccount): Promise<void> {
  runtime?.stop();
  owner = trader.address;
  signer = trader;
  const key = `opencash.bots.${trader.address.toLowerCase()}`;
  runtime = createBotRuntime({
    terminal,
    toolbox,
    trader,
    onChange: notify,
    smartPulses: pulseList,
    storage: {
      load: async () => {
        try {
          return JSON.parse((await AsyncStorage.getItem(key)) ?? "[]") as Bot[];
        } catch {
          return [];
        }
      },
      save: (bots) => AsyncStorage.setItem(key, JSON.stringify(bots)),
    },
  });
  await runtime.init();
  runtime.start();
  void startPaperCards(trader.address);
}

export const currentOwner = () => owner;
export const currentTrader = () => signer;

export function stopBots(): void {
  runtime?.stop();
  owner = null;
  signer = null;
  runtime = null;
  stopPaperCards();
  notify([]);
}

export async function draftBot(prompt: string, mode: BotMode, signal: "nansen" | null = null): Promise<string | null> {
  const symbols = (await toolbox.getMarkets()).map((m) => m.symbol);
  const card = await ruleDrafter(prompt, symbols);
  if (card === null || runtime === null) {
    return `Name a market and a side, like "long MON short BTC 2x $100 stop 8%". Markets: ${symbols.join(", ")}.`;
  }
  await runtime.add(createBot(card.name, mode, signal ? { ...card, signal } : card, Date.now()));
  return null;
}

export async function draftCard(prompt: string, signal: "nansen" | null = null): Promise<{ card: Bot["card"] | null; problem: string | null; note?: string }> {
  if (signer !== null) {
    const answer = await askAgent(backendUrl, signer.address, network, prompt);
    if (answer !== null) {
      const checked = answer.checked.length ? ` Checked: ${[...new Set(answer.checked)].join(", ")}.` : "";
      if (answer.card === null) return { card: null, problem: `${answer.reply}${checked}` };
      return { card: signal ? { ...answer.card, signal } : answer.card, problem: null, note: `${answer.reply}${checked}` };
    }
  }
  const symbols = (await toolbox.getMarkets()).map((m) => m.symbol);
  const card = await ruleDrafter(prompt, symbols);
  if (card === null) return { card: null, problem: `Name a market and a side, like "long MON short BTC 2x $100 stop 8%". Markets: ${symbols.join(", ")}.` };
  const account = signer ? await terminal.loadAccount(signer.address).catch(() => null) : null;
  const free = account === null ? 0 : Math.max(0, account.balance - account.lockedBalance);
  const sized = card.marginUsd > free && free >= 10 ? { ...card, marginUsd: Math.floor(free * 100) / 100 } : card;
  return { card: signal ? { ...sized, signal } : sized, problem: null };
}

export async function addBotFromCard(card: Bot["card"], mode: BotMode): Promise<void> {
  if (runtime === null) throw new Error("Bots are not running yet");
  await runtime.add(createBot(card.name, mode, card, Date.now()));
}

export const setBotEnabled = (id: string, enabled: boolean) => runtime?.setEnabled(id, enabled);
export const removeBot = (id: string) => runtime?.remove(id);
export const updateBotRules = (id: string, rules: Partial<Bot["rules"]>) =>
  runtime?.update(id, (bot) => ({ ...bot, rules: { ...bot.rules, ...rules } }));
