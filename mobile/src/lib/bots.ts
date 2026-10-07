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
} from "shared";
import { terminal } from "./perpl";

export const toolbox = createToolbox(perpl.createPerplApi(perpl.perplTestnet.apiUrl), defaultLimits);

let runtime: BotRuntime | null = null;
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
  const key = `opencash.bots.${trader.address.toLowerCase()}`;
  runtime = createBotRuntime({
    terminal,
    toolbox,
    trader,
    onChange: notify,
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
}

export function stopBots(): void {
  runtime?.stop();
  runtime = null;
  notify([]);
}

export async function draftBot(prompt: string, mode: BotMode): Promise<string | null> {
  const symbols = (await toolbox.getMarkets()).map((m) => m.symbol);
  const card = await ruleDrafter(prompt, symbols);
  if (card === null || runtime === null) {
    return `Name a market and a side, like "long MON short BTC 2x $100 stop 8%". Markets: ${symbols.join(", ")}.`;
  }
  await runtime.add(createBot(card.name, mode, card, Date.now()));
  return null;
}

export const setBotEnabled = (id: string, enabled: boolean) => runtime?.setEnabled(id, enabled);
export const removeBot = (id: string) => runtime?.remove(id);
export const updateBotRules = (id: string, rules: Partial<Bot["rules"]>) =>
  runtime?.update(id, (bot) => ({ ...bot, rules: { ...bot.rules, ...rules } }));
