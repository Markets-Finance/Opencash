import type { Toolbox } from "../agent/toolbox.js";
import { binFromCard } from "../strategy/convert.js";
import type { StrategyCard } from "../strategy/types.js";
import type { TradingAccount } from "../mera/index.js";
import { signalGate } from "../nansen/gate.js";
import type { SmartPulse } from "../nansen/types.js";
import { sizeBinFor, type createTerminal } from "../terminal/index.js";
import { checkEntry } from "./entry.js";
import { tickBot, type BotDeps, type HeldLeg } from "./engine.js";
import type { Bot } from "./types.js";

export type Terminal = ReturnType<typeof createTerminal>;

export type BotStorage = {
  load: () => Promise<Bot[]>;
  save: (bots: Bot[]) => Promise<void>;
};

export type BotRuntimeConfig = {
  terminal: Terminal;
  toolbox: Toolbox;
  trader: TradingAccount;
  storage: BotStorage;
  onChange: (bots: Bot[]) => void;
  intervalMs?: number;
  smartPulses?: (symbols: string[]) => Promise<SmartPulse[] | null>;
};

const defaultIntervalMs = 30_000;

export function createBotRuntime(config: BotRuntimeConfig) {
  const { terminal, toolbox, trader, storage, onChange, smartPulses } = config;
  let bots: Bot[] = [];
  let timer: ReturnType<typeof setInterval> | undefined;
  let busy = false;

  async function openPositionsFor(card: StrategyCard) {
    const data = await terminal.loadMarkets();
    const open = await terminal.loadOpenPositions(trader.address, data);
    return open.filter((entry) =>
      card.legs.some(
        (leg) =>
          leg.symbol === entry.market.symbol &&
          (leg.direction === "long") === (entry.position.positionType === 0),
      ),
    );
  }

  const deps: BotDeps = {
    now: Date.now,
    heldLegs: async (card) => {
      const held = await openPositionsFor(card);
      return held.map(
        (entry): HeldLeg => ({
          symbol: entry.market.symbol,
          direction: entry.position.positionType === 0 ? "long" : "short",
          depositUsd: entry.position.deposit,
          pnlUsd: entry.position.pnl,
        }),
      );
    },
    checkEntry: (card, minCarry) => checkEntry(card, minCarry, toolbox),
    signalGate: smartPulses
      ? async (card) => signalGate(card.legs, await smartPulses(card.legs.map((leg) => leg.symbol)))
      : async () => ({ ok: false, reason: "Nansen is not connected" }),
    open: async (card) => {
      const data = await terminal.loadMarkets();
      const { sized } = sizeBinFor(binFromCard(card), card.marginUsd, data);
      if (sized.legs.length === 0) throw new Error("No leg could be sized");
      let txHash: string | undefined;
      await terminal.openBin(trader, sized, data, (step, hash) => {
        if (step === "orders") txHash = hash;
      });
      return { txHash };
    },
    close: async (card) => {
      const held = await openPositionsFor(card);
      let txHash: string | undefined;
      for (const entry of held) txHash = await terminal.closePosition(trader, entry);
      return { txHash };
    },
  };

  async function persist() {
    await storage.save(bots);
    onChange(bots);
  }

  async function tickNow() {
    if (busy) return;
    busy = true;
    try {
      const next: Bot[] = [];
      for (const bot of bots) next.push(await tickBot(bot, deps));
      bots = next;
      await persist();
    } finally {
      busy = false;
    }
  }

  return {
    async init() {
      bots = (await storage.load()).map((bot) =>
        bot.status === "halted" ? bot : { ...bot, enabled: false, status: "idle" },
      );
      onChange(bots);
    },
    list: () => bots,
    start() {
      if (timer) return;
      timer = setInterval(() => void tickNow(), config.intervalMs ?? defaultIntervalMs);
      void tickNow();
    },
    stop() {
      clearInterval(timer);
      timer = undefined;
    },
    async add(bot: Bot) {
      bots = [bot, ...bots];
      await persist();
    },
    async update(id: string, patch: (bot: Bot) => Bot) {
      bots = bots.map((bot) => (bot.id === id ? patch(bot) : bot));
      await persist();
    },
    async remove(id: string) {
      bots = bots.filter((bot) => bot.id !== id);
      await persist();
    },
    async setEnabled(id: string, enabled: boolean) {
      bots = bots.map((bot) =>
        bot.id === id
          ? { ...bot, enabled, status: enabled ? "watching" : "idle", errorStreak: 0 }
          : bot,
      );
      await persist();
      if (enabled) void tickNow();
    },
    tickNow,
  };
}

export type BotRuntime = ReturnType<typeof createBotRuntime>;
