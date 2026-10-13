import { askAgent } from "shared";
import { network } from "../../../data/network";
import { bins, cardFromBin, ruleDrafter } from "../../perpl";
import { terminal } from "../../perpl";
import { session } from "../state";
import { esc, query } from "../dom";
import { addLeg, initCard, setCard } from "./card";
import { initLab } from "../lab";
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

export function initAgent() {
  void initLab();
  initCard();
  onAddLeg(addLeg);

  const hint = query("[data-agent-hint]");
  const input = query<HTMLInputElement>("[data-agent-input]");

  document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) =>
    button.addEventListener("click", async () => {
      button.disabled = true;
      pushOutcome(await run(button.dataset.tool!, readArgs(button.dataset.tool!)));
      button.disabled = false;
    }),
  );

  query("[data-agent-ideas]").innerHTML = bins
    .map((bin, index) => `<button type="button" class="chip" data-idea="${index}">${esc(bin.name)}</button>`)
    .join("");
  query("[data-agent-ideas]").addEventListener("click", (event) => {
    const chip = (event.target as HTMLElement).closest<HTMLElement>("[data-idea]");
    if (chip) setCard(cardFromBin(bins[Number(chip.dataset.idea)], 100, 10));
  });

  const chat = query("[data-agent-chat]");
  const send = query<HTMLButtonElement>("[data-agent-send]");

  function say(role: "me" | "bot", text: string, checked: string[] = []) {
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
    const thinking = say("bot", "Checking your balances and the markets…");
    try {
      if (session.trader) {
        const answer = await askAgent(import.meta.env.PUBLIC_BACKEND_URL ?? "http://localhost:8787", session.trader.address, network, text);
        if (answer !== null) {
          thinking.textContent = answer.reply || (answer.card ? "Here is a draft. Check it on the right." : "I could not draft that.");
          if (answer.checked.length > 0) {
            const pills = document.createElement("div");
            pills.className = "agent-checked";
            for (const item of new Set(answer.checked)) pills.insertAdjacentHTML("beforeend", `<span>${esc(item)}</span>`);
            thinking.append(pills);
          }
          if (answer.card !== null) setCard(answer.card);
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
