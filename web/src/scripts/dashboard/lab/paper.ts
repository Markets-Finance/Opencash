import { templates } from "shared";
import { esc, markForSymbol, query } from "../dom";
import { requireTrader } from "../state";
import { equityChart } from "./chart";
import { loadSeries, simOptions, type Series } from "./data";
import { ago, money, pct, tone } from "./format";
import { meta } from "./meta";

const refreshMs = 60_000;
let bots: templates.PaperBot[] = [];
let timer: ReturnType<typeof setInterval> | undefined;

function storageKey(): string {
  return `opencash.paper.${requireTrader().address.toLowerCase()}`;
}

function load(): templates.PaperBot[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey()) ?? "[]") as templates.PaperBot[];
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(bots));
  } catch {
    return;
  }
}

async function card(bot: templates.PaperBot): Promise<string> {
  const info = meta[bot.templateId];
  let body = `<p class="lab__empty">Loading prices.</p>`;
  try {
    const series = await loadSeries(bot.symbol, bot.resolution);
    const result = templates.runPaper(bot, series.candles, simOptions(series, bot.allocationUsd));
    const m = result.metrics;
    body =
      result.candles === 0
        ? `<p class="lab__empty">Waiting for the next candle. It acts when that candle closes.</p>`
        : `<div class="pbot__big pbot__big--${tone(m.returnPct)}">${pct(m.returnPct, 2)}</div>
          ${equityChart(result, bot.allocationUsd, bot.id, false)}
          <div class="pbot__stats">
            <span><small>Net</small>${money(m.netPnlUsd)}</span>
            <span><small>Exits</small>${m.closingFills}</span>
            <span><small>Worst dip</small>${m.maxDrawdownPct.toFixed(1)}%</span>
            <span><small>Running</small>${ago(Date.now() - bot.startedAt)}</span>
          </div>`;
  } catch (error) {
    body = `<p class="lab__empty">${esc(error instanceof Error ? error.message : String(error))}</p>`;
  }
  return `<div class="pbot tile tile--${info.tint}" data-paper="${esc(bot.id)}">
    <div class="pbot__head">
      ${markForSymbol(bot.symbol)}
      <span class="pbot__name">${esc(bot.name)}</span>
      <span class="pill">Paper</span>
      <span class="pbot__cap">Cap $${bot.allocationUsd}</span>
      <span class="bot__spacer"></span>
      <button type="button" class="link-btn" data-paper-delete>Delete</button>
    </div>
    ${body}
  </div>`;
}

export async function paintPapers() {
  const host = query("[data-paper-list]");
  host.innerHTML = (await Promise.all(bots.map(card))).join("");
  host.closest<HTMLElement>(".agent__bots")!.toggleAttribute("data-has-paper", bots.length > 0);
}

export async function addPaperBot(template: templates.Template, params: templates.Params, series: Series, allocationUsd: number) {
  const bot = templates.paperFromBot(`${template.name} · ${series.market.symbol}`, template.id, series.market.symbol, series.resolution, params, allocationUsd, Date.now());
  bots = [bot, ...bots];
  save();
  await paintPapers();
}

export function initPaper() {
  bots = load();
  void paintPapers();
  clearInterval(timer);
  timer = setInterval(() => {
    if (!document.hidden && bots.length > 0) void paintPapers();
  }, refreshMs);
  query("[data-paper-list]").addEventListener("click", async (event) => {
    const root = (event.target as HTMLElement).closest<HTMLElement>("[data-paper]");
    if (!root || !(event.target as HTMLElement).closest("[data-paper-delete]")) return;
    bots = bots.filter((bot) => bot.id !== root.dataset.paper);
    save();
    await paintPapers();
  });
}
