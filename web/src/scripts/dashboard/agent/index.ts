import { initLab } from "../lab";
import { askAgent } from "shared";
import { network } from "../../../data/network";
import type { StrategyCard } from "shared";
import { ruleDrafter } from "../../perpl";
import { rememberSoon, unlockMemory, type ChatEntry } from "./memory";
import { terminal } from "../../perpl";
import { session } from "../state";
import { esc, query } from "../dom";
import { addLeg, initCard, setCard } from "./card";
import { onAddLeg, pushOutcome } from "./feed";
import { run, toolbox } from "./session";

const argsByTool: Record<string, string[]> = {
  list_markets: [],
  market_snapshot: ["symbol"],
  funding_history: ["symbol", "days"],
  price_stats: ["symbol", "days"],
  order_book: ["symbol", "notionalUsd"],
  compare_pair: ["long", "short", "days"],
  smart_money: [],
};

function readArgs(tool: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  if (tool === "smart_money") {
    const names = ["symbol", "long", "short"].map((key) => query<HTMLInputElement>(`[data-arg=${key}]`).value.trim().toUpperCase());
    args.symbols = [...new Set(names.filter((name) => name !== ""))];
    return args;
  }
  for (const key of argsByTool[tool] ?? []) {
    const value = query<HTMLInputElement>(`[data-arg=${key}]`).value.trim();
    args[key] = key === "days" || key === "notionalUsd" ? Number(value) : value.toUpperCase();
  }
  return args;
}

export function initAnalysisTools() {
  document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) =>
    button.addEventListener("click", async () => {
      button.disabled = true;
      pushOutcome(await run(button.dataset.tool!, readArgs(button.dataset.tool!)));
      button.disabled = false;
    }),
  );
}

export function initAgent() {
  void initLab();
  initCard();
  onAddLeg(addLeg);

  const hint = query("[data-agent-hint]");
  const input = query<HTMLInputElement>("[data-agent-input]");

  const chat = query("[data-agent-chat]");
  const log: ChatEntry[] = [];
  let lastCard: StrategyCard | null = null;
  const memoryButton = query<HTMLButtonElement>("[data-agent-memory]");
  const memoryNote = query("[data-agent-memory-note]");
  const send = query<HTMLButtonElement>("[data-agent-send]");

  function say(role: "me" | "bot", text: string, checked: string[] = [], persist = true) {
    if (persist) log.push({ role, text, checked });
    const row = document.createElement("div");
    row.className = `agent-msg${role === "me" ? " agent-msg--me" : ""}`;
    const bubble = document.createElement("div");
    bubble.className = "agent-bubble";
    bubble.textContent = text;
    if (checked.length > 0) {
      const pills = document.createElement("div");
      pills.className = "agent-checked";
      for (const item of new Set(checked)) {
        const pill = document.createElement("span");
        pill.textContent = item;
        pills.append(pill);
      }
      bubble.append(pills);
    }
    if (role === "bot") {
      const avatar = document.createElement("span");
      avatar.className = "agent-avatar";
      avatar.textContent = "✦";
      row.append(avatar);
    }
    row.append(bubble);
    chat.append(row);
    row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return bubble;
  }

  const profileRaw = localStorage.getItem("opencash.profile");
  if (profileRaw && session.trader) {
    try {
      const name = (JSON.parse(session.trader.openProfile(JSON.parse(profileRaw))) as { name?: string }).name?.split(" ")[0];
      if (name) query("[data-agent-greeting]").textContent = `Hi ${name}! I'm your trading agent. Tell me what you want in plain words. I check your balance and the markets myself, then draft a strategy card. I only draft. You approve every trade.`;
    } catch {}
  }

  async function ask(text: string) {
    hint.textContent = "";
    hint.dataset.tone = "";
    say("me", text);
    input.value = "";
    send.disabled = true;
    const earlier = log.slice(0, -1).slice(-8).map((entry) => ({ role: entry.role === "me" ? ("user" as const) : ("assistant" as const), content: entry.text }));
    const thinking = say("bot", "Checking your balances and the markets…", [], false);
    try {
      if (session.trader) {
        const answer = await askAgent(import.meta.env.PUBLIC_BACKEND_URL ?? "http://localhost:8787", session.trader.address, network, text, earlier);
        if (answer !== null) {
          thinking.textContent = answer.reply || (answer.card ? "Here is a draft. Check it on the right." : "I could not draft that.");
          if (answer.checked.length > 0) {
            const pills = document.createElement("div");
            pills.className = "agent-checked";
            for (const item of new Set(answer.checked)) pills.insertAdjacentHTML("beforeend", `<span>${esc(item)}</span>`);
            thinking.append(pills);
          }
          if (answer.card !== null) {
            setCard(answer.card);
            lastCard = answer.card;
          }
          log.push({ role: "bot", text: thinking.firstChild?.textContent ?? "", checked: answer.checked });
          rememberSoon({ messages: log, card: lastCard });
          return;
        }
      }
      const symbols = (await toolbox.getMarkets()).map((m) => m.symbol);
      const drafted = await ruleDrafter(text, symbols);
      if (drafted === null) {
        thinking.textContent = `I could not read that. Name a market and a side, for example "long MON short BTC 2x $100 stop 8%". Markets: ${symbols.join(", ")}.`;
        return;
      }
      const account = session.trader ? await terminal.loadAccount(session.trader.address).catch(() => null) : null;
      const free = account === null ? 0 : Math.max(0, account.balance - account.lockedBalance);
      const fitted = drafted.marginUsd > free && free >= 10;
      thinking.textContent = fitted
        ? `Drafted from your words. I sized the margin to your free Perpl balance, $${free.toFixed(2)}. Check the card on the right.`
        : "Drafted from your words. Check the card on the right.";
      setCard(fitted ? { ...drafted, marginUsd: Math.floor(free * 100) / 100 } : drafted);
    } catch (error) {
      thinking.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      send.disabled = false;
    }
  }

  memoryButton.addEventListener("click", async () => {
    memoryButton.disabled = true;
    memoryNote.textContent = "Waiting for your passkey…";
    try {
      const saved = await unlockMemory();
      if (saved.messages.length > 0) {
        log.splice(0, log.length, ...saved.messages);
        chat.querySelectorAll(".agent-msg:not(:first-child)").forEach((node) => node.remove());
        for (const entry of saved.messages) say(entry.role, entry.text, entry.checked ?? [], false);
        if (saved.card) {
          setCard(saved.card);
          lastCard = saved.card;
        }
      }
      memoryButton.hidden = true;
      memoryNote.textContent = "Memory on. Your chats are sealed with your passkey and follow you to any device.";
    } catch (error) {
      memoryNote.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      memoryButton.disabled = false;
    }
  });

  query<HTMLFormElement>("[data-agent-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (text !== "") void ask(text);
  });

  query("[data-agent-prompts]").addEventListener("click", (event) => {
    const chip = (event.target as HTMLElement).closest<HTMLElement>("[data-prompt]");
    if (chip?.dataset.prompt) void ask(chip.dataset.prompt);
  });
}
