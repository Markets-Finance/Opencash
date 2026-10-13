import type { Bot } from "../../perpl";
import { esc } from "../dom";

type Entry = { bot: Bot; kind: "live" | "paper" };

export function initTradeStrip() {
  const host = document.querySelector<HTMLElement>("[data-trade-agent]");
  if (!host) return;

  document.addEventListener("bots:changed", (event) => {
    const running = (event as CustomEvent<Entry[]>).detail.filter((entry) => entry.bot.enabled);
    host.hidden = running.length === 0;
    host.innerHTML = running
      .map(
        ({ bot, kind }) => `<div class="trade-agent__row">
          <b>Agent</b><span>${esc(bot.name)}</span><span class="pill pill--${kind}">${kind === "live" ? "Live" : "Paper"}</span>
          <span class="pill pill--${bot.status}">${bot.status}</span>
          <span>${esc(bot.lastCheck?.message ?? "Starting…")}</span>
          <button type="button" class="link-btn" data-open-bots>Manage</button>
        </div>`,
      )
      .join("");
  });

  host.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("[data-open-bots]")) document.querySelector<HTMLElement>('[data-tab="agent"]')?.click();
  });
}
