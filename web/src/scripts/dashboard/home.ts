import type { BinPosition } from "shared";
import { perpl } from "shared";
import { bins, terminal, type MarketData } from "../perpl";
import { drawBars, drawLine } from "./charts";
import { toolbox } from "./agent/session";
import { filterHistory, loadHistory, recordSnapshot, type HistoryRange } from "./history";
import { changeClass, legStackHtml, markForSymbol, px, query, usd } from "./dom";
import { getMarketData, getPositions } from "./market";
import { requireTrader } from "./state";

const lowGasMon = 0.08;

const featuredSymbols = [...new Set(bins.flatMap((bin) => bin.legs.map((leg) => leg.symbol)))];

function listedSymbols(data: MarketData): string[] {
  return featuredSymbols.filter((symbol) => data.markets.has(symbol));
}

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
        <tr class="asset-row--link" data-open-asset="${position.legs[0]?.symbol ?? "BTC"}" tabindex="0">
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
  container.innerHTML = listedSymbols(data)
    .map((symbol) => {
      const market = data.markets.get(symbol);
      return `
        <div class="asset-row asset-row--link" data-open-asset="${symbol}" role="button" tabindex="0" aria-label="Trade ${symbol}">
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
  container.innerHTML = listedSymbols(data)
    .slice(0, 4)
    .map((symbol) => {
      const market = data.markets.get(symbol);
      return `
        <div class="ticker-card asset-row--link" data-open-asset="${symbol}" role="button" tabindex="0" aria-label="Trade ${symbol}">
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

  async function showVolume() {
    const label = document.querySelector<HTMLElement>("[data-portfolio-label]");
    if (label) label.textContent = "Perpl volume · last 7 days";
    query("[data-portfolio-range]").hidden = true;
    chartEl.innerHTML = '<div class="chart-empty">Loading Perpl volume…</div>';
    const series = await perpl.exchangeVolumeSeries(toolbox, 7).catch(() => []);
    drawBars(chartEl, series, "Perpl volume is unavailable right now.");
  }

  const changeEl = query("[data-wallet-change]");
  const coinsEl = query("[data-wallet-coins]");

  function paintTotal(total: number, pnl: number, symbols: string[]) {
    const [whole, cents] = Math.abs(total).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(".");
    balanceEl.innerHTML = `${total < 0 ? "−" : ""}$${whole}<small>.${cents}</small><small class="wallet__unit"> AUSD</small>`;
    changeEl.textContent = `${pnl >= 0 ? "+" : "−"} ${usd(Math.abs(pnl))} AUSD`;
    coinsEl.innerHTML = symbols.slice(0, 4).map(markForSymbol).join("");
    updatedEl.textContent = new Date().toLocaleTimeString();
  }

  async function checkGas() {
    const warning = query("[data-gas-warning]");
    const mon = await terminal.loadNativeBalance(trader.address).catch(() => null);
    warning.hidden = mon === null || mon >= lowGasMon;
    warning.textContent = `Low on gas: ${(mon ?? 0).toFixed(3)} MON left. Add MON to ${trader.address.slice(0, 6)}…${trader.address.slice(-4)} so your next trades go through.`;
  }

  async function refreshBalance() {
    void checkGas();
    const data = await getMarketData();
    const summary = await terminal.loadSummary(trader.address, data);
    paintTotal(summary.total, summary.unrealizedPnl, summary.symbols.length ? summary.symbols : listedSymbols(data));
  }
  query<HTMLButtonElement>("[data-home-refresh]").addEventListener("click", () => void refreshBalance().catch(() => {}));
  void refreshBalance().catch(() => {});

  try {
    const data = await getMarketData();
    renderMarkets(query("[data-top-assets]"), data);
    renderTicker(query("[data-ticker-row]"), data);
    const summary = await terminal.loadSummary(trader.address, data);
    portfolioValueEl.textContent = `${usd(summary.total)} AUSD`;
    portfolioChangeEl.textContent = `${usd(summary.unrealizedPnl)} AUSD unrealised`;
    portfolioChangeEl.className = `chart-change ${changeClass(summary.unrealizedPnl)}`;
    history = recordSnapshot(trader.address, summary.total);
    if (summary.symbols.length === 0) await showVolume();
    else paintHistory();
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
