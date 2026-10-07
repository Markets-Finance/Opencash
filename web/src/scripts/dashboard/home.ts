import type { BinPosition } from "shared";
import { bins, terminal, type MarketData } from "../perpl";
import { drawLine } from "./charts";
import { filterHistory, loadHistory, recordSnapshot, type HistoryRange } from "./history";
import { changeClass, legStackHtml, markForSymbol, px, query, usd } from "./dom";
import { getMarketData, getPositions } from "./market";
import { requireTrader } from "./state";

const featuredSymbols = [...new Set(bins.flatMap((bin) => bin.legs.map((leg) => leg.symbol)))];

function renderPositionsTable(container: HTMLElement, positions: BinPosition[]) {
  if (positions.length === 0) {
    container.className = "empty";
    container.textContent = "No open positions yet. Open a bin to take a framing.";
    return;
  }
  container.className = "table-wrap";
  const rows = positions
    .map(
      (position) => `
        <tr>
          <td><div class="cell-identity">${legStackHtml(position.legs.map((leg) => leg.symbol))}${position.bin.name}</div></td>
          <td class="cell-muted">${position.legs.map((leg) => leg.symbol).join(", ")}</td>
          <td class="cell-value">${usd(position.deposit + position.pnl)}</td>
        </tr>`,
    )
    .join("");
  container.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Bin</th><th>Legs</th><th style="text-align:right">Value</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderMarkets(container: HTMLElement, data: MarketData) {
  container.className = "asset-list";
  container.innerHTML = featuredSymbols
    .map((symbol) => {
      const market = data.markets.get(symbol);
      return `
        <div class="asset-row">
          ${markForSymbol(symbol)}
          <span class="asset-row__identity">${symbol}</span>
          <span class="asset-row__price">${market ? px(market.mark) : "—"}</span>
          <span class="asset-row__change">${market ? `max ${data.maxLeverage.get(symbol) ?? "—"}x` : "—"}</span>
        </div>`;
    })
    .join("");
}

function renderTicker(container: HTMLElement, data: MarketData) {
  container.className = "ticker-row";
  container.innerHTML = featuredSymbols
    .slice(0, 4)
    .map((symbol) => {
      const market = data.markets.get(symbol);
      return `
        <div class="ticker-card">
          <div class="ticker-card__head">${markForSymbol(symbol)}<span class="ticker-card__symbol">${symbol}</span></div>
          <span class="ticker-card__price">${market ? px(market.mark) : "—"}</span>
        </div>`;
    })
    .join("");
}

export async function initHome() {
  const trader = requireTrader();
  const balanceEl = query("[data-home-balance]");
  const updatedEl = query("[data-home-updated]");
  const portfolioValueEl = query("[data-portfolio-value]");
  const portfolioChangeEl = query("[data-portfolio-change]");

  const chartEl = query("[data-portfolio-chart]");
  const rangeButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-portfolio-range] [data-range]"),
  );
  let history = loadHistory(trader.address);
  let range: HistoryRange = "1d";

  function paintHistory() {
    drawLine(
      chartEl,
      filterHistory(history, range),
      "Portfolio history builds up as you use the app. Each visit adds a data point.",
    );
  }
  rangeButtons.forEach((button) =>
    button.addEventListener("click", () => {
      range = button.dataset.range as HistoryRange;
      rangeButtons.forEach((b) => b.classList.toggle("chip--active", b === button));
      paintHistory();
    }),
  );
  paintHistory();

  async function refreshBalance() {
    balanceEl.textContent = usd(await terminal.loadCollateralBalance(trader.address));
    updatedEl.textContent = new Date().toLocaleTimeString();
  }
  query<HTMLButtonElement>("[data-home-refresh]").addEventListener("click", () => void refreshBalance().catch(() => {}));
  void refreshBalance().catch(() => {
    balanceEl.textContent = "—";
  });

  try {
    const data = await getMarketData();
    renderMarkets(query("[data-top-assets]"), data);
    renderTicker(query("[data-ticker-row]"), data);
    const summary = await terminal.loadSummary(trader.address, data);
    portfolioValueEl.textContent = usd(summary.total);
    portfolioChangeEl.textContent = `${usd(summary.unrealizedPnl)} unrealised`;
    portfolioChangeEl.className = `chart-change ${changeClass(summary.unrealizedPnl)}`;
    history = recordSnapshot(trader.address, summary.total);
    paintHistory();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    for (const selector of ["[data-top-assets]", "[data-ticker-row]"]) {
      const el = query(selector);
      el.className = "error-text";
      el.textContent = message;
    }
  }

  renderPositionsTable(query("[data-home-positions-table]"), await getPositions().catch(() => []));
}
