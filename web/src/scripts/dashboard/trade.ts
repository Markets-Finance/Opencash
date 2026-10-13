import { label as networkName } from "../../data/network";
import { estimateExecution, liquidationDistancePct, summarizeDepth, perpl, slippageWarnBps, type ExecutionEstimate } from "shared";
import { singleLegBin, sizeBinFor, terminal, type CandleRangeKey, type OpenPosition } from "../perpl";
import { exitsFor } from "./bots";
import { drawCandles } from "./charts";
import { loadCandles } from "../perplApi";
import { changeClass, errorText, markForSymbol, px, query, say, usd } from "./dom";
import { getMarketData } from "./market";
import { initBoard } from "./board";
import { toolbox } from "./agent/session";
import { flowText, loadPulses, stanceText } from "./nansen";
import { requireTrader } from "./state";
import { activateTab } from "./tabs";

type Side = "long" | "short";

let searchTerm = "";
let symbol = "BTC";
let side: Side = "long";
let positions: OpenPosition[] = [];
let range: CandleRangeKey = "1d";
let rerender: () => void = () => {};
let openHook: ((next: string) => void) | null = null;
let pendingAsset = false;
let accepted = false;
let availableUsd = 0;
let maintenance: number | null = null;
let costRun = 0;

export function openAsset(next: string) {
  symbol = next;
  searchTerm = "";
  if (openHook) openHook(next);
  else pendingAsset = true;
  activateTab("trade");
}

export function setTradeQuery(value: string) {
  searchTerm = value;
  rerender();
}

function elements() {
  return {
    balance: query("[data-trade-balance]"),
    updated: query("[data-trade-updated]"),
    note: query("[data-trade-wallet-note]"),
    label: query("[data-trade-market-label]"),
    price: query("[data-trade-market-price]"),
    meta: query("[data-trade-market-meta]"),
    chart: query("[data-trade-chart]"),
    desk: query("[data-trade-desk]"),
    deskStatus: query("[data-trade-desk-status]"),
    title: query("[data-trade-ticket-title]"),
    margin: query<HTMLInputElement>("[data-ticket-margin]"),
    leverage: query<HTMLInputElement>("[data-ticket-leverage]"),
    size: query("[data-ticket-size]"),
    cost: query("[data-ticket-cost]"),
    levLabel: query("[data-ticket-leverage-label]"),
    levBox: query(".lev"),
    ticks: query("[data-ticket-ticks]"),
    risk: query("[data-ticket-risk]"),
    available: query("[data-ticket-available]"),
    quick: query("[data-ticket-quick]"),
    submit: query<HTMLButtonElement>("[data-ticket-submit]"),
    status: query("[data-ticket-status]"),
    stats: query("[data-trade-stats]"),
    depth: query("[data-trade-depth]"),
    list: query("[data-trade-list]"),
    asset: query("[data-trade-asset]"),
    search: query<HTMLInputElement>("[data-trade-search]"),
  };
}

export async function initTrade() {
  const trader = requireTrader();
  const ui = elements();
  const data = await getMarketData();
  if (!data.markets.has(symbol)) symbol = [...data.markets.keys()][0] ?? symbol;

  const board = initBoard(data, (next, chosen) => {
    if (chosen) setSide(chosen);
    showAsset(next);
  });

  function renderMarkets() {
    board.setSearch(searchTerm);
  }

  function setSide(next: Side) {
    side = next;
    document.querySelectorAll<HTMLButtonElement>("[data-side]").forEach((b) => b.classList.toggle("is-on", b.dataset.side === next));
  }

  function renderMarketHead() {
    const market = data.markets.get(symbol);
    ui.label.textContent = market ? `${market.symbol} · ${market.name}` : "—";
    ui.price.textContent = market ? px(market.mark) : "—";
    ui.meta.textContent = market ? `max ${data.maxLeverage.get(symbol) ?? "—"}x · ${market.numOrders} resting orders` : "";
    ui.title.textContent = `${side === "long" ? "Long" : "Short"} ${symbol}`;
    syncLeverageRange();
    maintenance = null;
    const shown = symbol;
    void toolbox.getMarket(shown).then((market) => {
      if (shown !== symbol) return;
      maintenance = market.maintenanceLeverage;
      paintLeverage();
    }).catch(() => {});
  }

  function syncLeverageRange() {
    const max = Math.max(1, data.maxLeverage.get(symbol) ?? 1);
    ui.leverage.max = String(max);
    if (Number(ui.leverage.value) > max) ui.leverage.value = String(max);
    const marks = [...new Set([1, Math.round(max / 3), Math.round((max * 2) / 3), max])].filter((value) => value >= 1);
    ui.ticks.innerHTML = marks.map((value) => `<button type="button" data-lev-tick="${value}">${value}x</button>`).join("");
    paintLeverage();
  }

  function paintLeverage() {
    const max = Number(ui.leverage.max) || 1;
    const value = Number(ui.leverage.value) || 1;
    ui.levLabel.textContent = `${value}x`;
    ui.leverage.style.setProperty("--fill", `${max > 1 ? ((value - 1) / (max - 1)) * 100 : 100}%`);
    const ratio = max > 1 ? (value - 1) / (max - 1) : 0;
    ui.levBox.dataset.levRisk = ratio < 0.34 ? "low" : ratio < 0.67 ? "mid" : "high";
    ui.risk.textContent = maintenance
      ? `About a ${liquidationDistancePct(value, maintenance).toFixed(1)}% move against you liquidates this position.`
      : "";
  }

  async function renderChart() {
    const market = data.markets.get(symbol);
    if (!market) return;
    const shown = symbol;
    try {
      const candles = await loadCandles(market, range);
      const held = positions.find((entry) => entry.market.symbol === symbol);
      const maintenanceLeverage = held ? await toolbox.getMarket(symbol).then((m) => m.maintenanceLeverage).catch(() => null) : null;
      const lines = held ? perpl.tradeOverlay(held.position, maintenanceLeverage, exitsFor(symbol)) : [];
      if (shown === symbol) drawCandles(ui.chart, candles, `No trades in this range on ${networkName}.`, lines.length > 0 ? { lines } : undefined);
    } catch (error) {
      ui.chart.innerHTML = `<div class="chart-empty">${errorText(error)}</div>`;
    }
  }

  function currentSizing() {
    const margin = Number(ui.margin.value);
    const leverage = Math.min(Number(ui.leverage.value) || 1, data.maxLeverage.get(symbol) ?? 1);
    if (!(margin > 0)) return null;
    return sizeBinFor(singleLegBin(symbol, side, leverage), margin, data);
  }

  function isRisky(estimate: ExecutionEstimate | null) {
    return estimate !== null && (estimate.slippageBps === null || estimate.slippageBps > slippageWarnBps);
  }

  let lastEstimate: ExecutionEstimate | null = null;

  function paintCost(estimate: ExecutionEstimate | null) {
    lastEstimate = estimate;
    ui.cost.hidden = estimate === null;
    if (estimate === null) return;
    const risky = isRisky(estimate);
    const funding = estimate.fundingDailyUsd;
    const rows: [string, string][] = [
      ["Slippage", estimate.slippageBps === null ? "Beyond the book" : `${estimate.slippageBps.toFixed(1)} bps · ${usd(estimate.slippageUsd ?? 0)}`],
      ["Spread", `${estimate.spreadBps.toFixed(1)} bps`],
      ["Taker fee", usd(estimate.feeUsd)],
      ["Funding a day", `${funding >= 0 ? "pay" : "earn"} ${usd(Math.abs(funding))}`],
    ];
    ui.cost.innerHTML =
      rows.map(([label, value], index) => `<div class="cost__row${risky && index === 0 ? " cost__row--warn" : ""}"><span>${label}</span><b>${value}</b></div>`).join("") +
      (risky ? `<p class="cost__warn">Thin book for this size. Up to ${usd(estimate.maxSizeUsd)} fills within ${slippageWarnBps} bps.</p>` : "");
  }

  async function renderCost() {
    const run = ++costRun;
    const sizing = currentSizing();
    const leg = sizing?.sized.legs[0];
    if (!leg) return paintCost(null);
    const shown = symbol;
    try {
      const [book, { snapshot }] = await Promise.all([toolbox.getBook(shown), toolbox.getSnapshot(shown)]);
      if (run !== costRun) return;
      paintCost(
        estimateExecution({
          book,
          side: side === "long" ? "buy" : "sell",
          notionalUsd: leg.notional,
          takerFeeBps: snapshot.takerFeeBps,
          fundingAprPct: snapshot.funding.nowAprPct,
        }),
      );
    } catch {
      if (run === costRun) paintCost(null);
    }
  }

  function renderTicketSize() {
    const sizing = currentSizing();
    const leg = sizing?.sized.legs[0];
    ui.size.textContent = leg
      ? `${leg.lots} ${symbol} · ${usd(leg.notional)} notional · ${leg.leverage}x`
      : (sizing?.issues[0]?.detail ?? "");
    accepted = false;
    ui.submit.textContent = `${side === "long" ? "Long" : "Short"} ${symbol}`;
    ui.submit.dataset.side = side;
    void renderCost();
  }

  function renderDesk() {
    if (positions.length === 0) {
      ui.desk.className = "empty";
      ui.desk.textContent = `No open positions on ${networkName} for this address.`;
      return;
    }
    ui.desk.className = "table-wrap";
    ui.desk.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Market</th><th>Size</th><th>Entry</th><th>Margin</th><th style="text-align:right">PnL</th><th></th></tr></thead>
        <tbody>${positions
          .map(
            (entry, index) => `
              <tr>
                <td><div class="cell-identity">${markForSymbol(entry.market.symbol)}${entry.position.positionType === perpl.OrderType.OpenLong ? "Long" : "Short"} ${entry.market.symbol}</div></td>
                <td class="cell-muted">${entry.position.lots}</td>
                <td class="cell-muted">${px(entry.position.entryPrice)}</td>
                <td class="cell-muted">${usd(entry.position.deposit)}</td>
                <td class="cell-value ${changeClass(entry.position.pnl)}">${usd(entry.position.pnl)}</td>
                <td><button type="button" class="link-btn" data-close-index="${index}">Close</button></td>
              </tr>`,
          )
          .join("")}</tbody>
      </table>`;
    ui.desk.querySelectorAll<HTMLButtonElement>("[data-close-index]").forEach((button) =>
      button.addEventListener("click", async () => {
        const entry = positions[Number(button.dataset.closeIndex)];
        button.disabled = true;
        say(ui.deskStatus, "Closing…");
        try {
          await terminal.closePosition(trader, entry);
          say(ui.deskStatus, `${entry.market.symbol} closed.`);
          await refresh();
        } catch (error) {
          say(ui.deskStatus, errorText(error), "error");
          button.disabled = false;
        }
      }),
    );
  }

  async function refresh() {
    const [account, collateral, open] = await Promise.all([
      terminal.loadAccount(trader.address),
      terminal.loadSpendableBalance(trader.address),
      terminal.loadOpenPositions(trader.address, data),
    ]);
    positions = open;
    if (!ui.asset.hidden) void renderChart();
    ui.balance.textContent = usd(account?.balance ?? 0);
    availableUsd = collateral + (account?.balance ?? 0);
    ui.available.textContent = `Available ${usd(availableUsd)}`;
    ui.note.textContent = `Wallet ${usd(collateral)} AUSD${account ? "" : " · no Perpl account yet, the first order creates one"}`;
    ui.updated.textContent = new Date().toLocaleTimeString();
    renderDesk();
  }

  function showAsset(next: string) {
    symbol = next;
    ui.list.hidden = true;
    ui.asset.hidden = false;
    renderAll();
    void loadStats();
    window.scrollTo({ top: 0 });
  }

  function showList() {
    ui.asset.hidden = true;
    ui.list.hidden = false;
    renderMarkets();
  }

  const compact = (value: number) => (value >= 1e6 ? `$${(value / 1e6).toFixed(2)}M` : value >= 1e3 ? `$${(value / 1e3).toFixed(1)}K` : `$${value.toFixed(0)}`);

  async function loadStats() {
    const shown = symbol;
    ui.stats.innerHTML = `<p class="empty">Loading…</p>`;
    ui.depth.innerHTML = "";
    try {
      const [{ snapshot }, book] = await Promise.all([toolbox.getSnapshot(shown), toolbox.getBook(shown).catch(() => null)]);
      if (shown !== symbol) return;
      const mid = book && book.bids[0] && book.asks[0] ? (book.bids[0].price + book.asks[0].price) / 2 : 0;
      const depth = book && mid > 0 ? summarizeDepth(book, mid) : null;
      const cells: [string, string][] = [
        ["24h volume", compact(snapshot.volume24hUsd)],
        ["Open interest", compact(snapshot.openInterestUsd)],
        ["Max leverage", `${snapshot.maxLeverage}x`],
        ["Today", `${snapshot.change24hPct >= 0 ? "▲" : "▼"} ${Math.abs(snapshot.change24hPct).toFixed(2)}%`],
        ["Spread", `${snapshot.spreadBps.toFixed(1)} bps`],
        ["Funding now", `${snapshot.funding.nowAprPct.toFixed(1)}% a year`],
        ["Funding avg 7d", `${snapshot.funding.meanAprPct.toFixed(1)}% a year`],
        ["Fees maker · taker", `${snapshot.makerFeeBps.toFixed(1)} · ${snapshot.takerFeeBps.toFixed(1)} bps`],
      ];
      const pulse = (await loadPulses([shown]))?.get(shown.toUpperCase());
      if (shown !== symbol) return;
      if (pulse && pulse.tokens.length > 0) cells.push(["Smart money 7d (Nansen)", `${stanceText(pulse.stance)} ${flowText(pulse.flow7dUsd)}`]);
      ui.depth.innerHTML = depth
        ? ([
            ["10 bps", depth.bidUsdWithin10Bps, depth.askUsdWithin10Bps],
            ["25 bps", depth.bidUsdWithin25Bps, depth.askUsdWithin25Bps],
            ["50 bps", depth.bidUsdWithin50Bps, depth.askUsdWithin50Bps],
          ] as [string, number, number][])
            .map(([label, bid, ask]) => {
              const share = bid + ask > 0 ? Math.round((bid / (bid + ask)) * 100) : 50;
              return `<div class="depth__row"><span class="depth__label">Within ${label}</span><b class="depth__bid">${compact(bid)}</b><div class="depth__bar" style="--bid:${share}%"><i></i></div><b class="depth__ask">${compact(ask)}</b></div>`;
            })
            .join("")
        : `<p class="empty">Book unavailable.</p>`;
      ui.stats.innerHTML = cells.map(([label, value]) => `<div class="stat"><small>${label}</small><b>${value}</b></div>`).join("");
    } catch (error) {
      ui.stats.innerHTML = `<p class="empty">${errorText(error)}</p>`;
    }
  }

  function renderAll() {
    renderMarkets();
    renderMarketHead();
    renderTicketSize();
    void renderChart();
  }
  rerender = renderMarkets;
  openHook = (next) => showAsset(next);
  ui.search.addEventListener("input", () => {
    searchTerm = ui.search.value.trim().toLowerCase();
    renderMarkets();
  });
  query<HTMLButtonElement>("[data-trade-back]").addEventListener("click", showList);

  const rangeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-trade-range] [data-range]"));
  rangeButtons.forEach((button) =>
    button.addEventListener("click", () => {
      range = button.dataset.range as CandleRangeKey;
      rangeButtons.forEach((b) => b.classList.toggle("chip--active", b === button));
      void renderChart();
    }),
  );

  document.querySelectorAll<HTMLButtonElement>("[data-side]").forEach((button) =>
    button.addEventListener("click", () => {
      side = button.dataset.side as Side;
      document
        .querySelectorAll<HTMLButtonElement>("[data-side]")
        .forEach((b) => b.classList.toggle("is-on", b === button));
      renderMarketHead();
      renderTicketSize();
    }),
  );
  ui.margin.addEventListener("input", renderTicketSize);
  ui.leverage.addEventListener("input", () => {
    paintLeverage();
    renderTicketSize();
  });
  ui.ticks.addEventListener("click", (event) => {
    const tick = (event.target as HTMLElement).closest<HTMLElement>("[data-lev-tick]");
    if (!tick) return;
    ui.leverage.value = tick.dataset.levTick!;
    paintLeverage();
    renderTicketSize();
  });
  ui.quick.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-quick]");
    if (!button || !(availableUsd > 0)) return;
    ui.margin.value = (Math.floor(availableUsd * Number(button.dataset.quick) * 100) / 100).toString();
    renderTicketSize();
  });
  query<HTMLButtonElement>("[data-trade-refresh]").addEventListener("click", () => void refresh().catch(() => {}));

  ui.submit.addEventListener("click", async () => {
    const sizing = currentSizing();
    if (!sizing || sizing.sized.legs.length === 0) {
      say(ui.status, sizing?.issues[0]?.detail ?? "Enter a margin amount.", "error");
      return;
    }
    if (isRisky(lastEstimate) && !accepted) {
      accepted = true;
      ui.submit.textContent = "Click again to accept slippage";
      return;
    }
    ui.submit.disabled = true;
    say(ui.status, "Waiting for your passkey…");
    try {
      await terminal.openBin(trader, sizing.sized, data, (step) =>
        say(ui.status, step === "orders" ? "Opening position…" : step === "fund" ? "Funding account…" : "Approving AUSD…"),
      );
      say(ui.status, `${side === "long" ? "Long" : "Short"} ${symbol} is open.`);
      ui.margin.value = "";
      renderTicketSize();
      await refresh();
    } catch (error) {
      say(ui.status, errorText(error), "error");
    } finally {
      ui.submit.disabled = false;
    }
  });

  renderAll();
  renderMarkets();
  if (pendingAsset) {
    pendingAsset = false;
    showAsset(symbol);
  }
  await refresh().catch((error) => say(ui.deskStatus, errorText(error), "error"));
}
