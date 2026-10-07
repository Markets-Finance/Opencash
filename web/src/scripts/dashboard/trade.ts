import { perpl } from "shared";
import { singleLegBin, sizeBinFor, terminal, type OpenPosition } from "../perpl";
import { changeClass, errorText, markForSymbol, px, query, say, usd } from "./dom";
import { getMarketData } from "./market";
import { requireTrader } from "./state";

type Side = "long" | "short";

let searchTerm = "";
let symbol = "BTC";
let side: Side = "long";
let positions: OpenPosition[] = [];
let rerender: () => void = () => {};

export function setTradeQuery(value: string) {
  searchTerm = value;
  rerender();
}

function elements() {
  return {
    balance: query("[data-trade-balance]"),
    updated: query("[data-trade-updated]"),
    note: query("[data-trade-wallet-note]"),
    assets: query("[data-trade-assets]"),
    label: query("[data-trade-market-label]"),
    price: query("[data-trade-market-price]"),
    meta: query("[data-trade-market-meta]"),
    desk: query("[data-trade-desk]"),
    deskStatus: query("[data-trade-desk-status]"),
    title: query("[data-trade-ticket-title]"),
    margin: query<HTMLInputElement>("[data-ticket-margin]"),
    leverage: query<HTMLInputElement>("[data-ticket-leverage]"),
    size: query("[data-ticket-size]"),
    submit: query<HTMLButtonElement>("[data-ticket-submit]"),
    status: query("[data-ticket-status]"),
  };
}

export async function initTrade() {
  const trader = requireTrader();
  const ui = elements();
  const data = await getMarketData();
  if (!data.markets.has(symbol)) symbol = [...data.markets.keys()][0] ?? symbol;

  function renderMarkets() {
    const list = [...data.markets.values()].filter(
      (m) => m.numOrders > 0 && (searchTerm === "" || m.symbol.toLowerCase().includes(searchTerm)),
    );
    ui.assets.className = "asset-list";
    ui.assets.innerHTML = list
      .map(
        (m) => `
          <div class="asset-row" data-symbol="${m.symbol}" style="cursor:pointer">
            ${markForSymbol(m.symbol)}
            <span class="asset-row__identity">${m.symbol}</span>
            <span class="asset-row__price">${px(m.mark)}</span>
            <span class="asset-row__change">max ${data.maxLeverage.get(m.symbol) ?? "—"}x</span>
          </div>`,
      )
      .join("");
    ui.assets.querySelectorAll<HTMLElement>("[data-symbol]").forEach((row) =>
      row.addEventListener("click", () => {
        symbol = row.dataset.symbol!;
        renderAll();
      }),
    );
  }

  function renderMarketHead() {
    const market = data.markets.get(symbol);
    ui.label.textContent = market ? `${market.symbol} · ${market.name}` : "—";
    ui.price.textContent = market ? px(market.mark) : "—";
    ui.meta.textContent = market ? `max ${data.maxLeverage.get(symbol) ?? "—"}x · ${market.numOrders} resting orders` : "";
    ui.title.textContent = `${side === "long" ? "Long" : "Short"} ${symbol}`;
  }

  function currentSizing() {
    const margin = Number(ui.margin.value);
    const leverage = Math.min(Number(ui.leverage.value) || 1, data.maxLeverage.get(symbol) ?? 1);
    if (!(margin > 0)) return null;
    return sizeBinFor(singleLegBin(symbol, side, leverage), margin, data);
  }

  function renderTicketSize() {
    const sizing = currentSizing();
    const leg = sizing?.sized.legs[0];
    ui.size.textContent = leg
      ? `${leg.lots} ${symbol} · ${usd(leg.notional)} notional · ${leg.leverage}x`
      : (sizing?.issues[0]?.detail ?? "");
  }

  function renderDesk() {
    if (positions.length === 0) {
      ui.desk.className = "empty";
      ui.desk.textContent = "No open positions on Monad testnet for this address.";
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
      terminal.loadCollateralBalance(trader.address),
      terminal.loadOpenPositions(trader.address, data),
    ]);
    positions = open;
    ui.balance.textContent = usd(account?.balance ?? 0);
    ui.note.textContent = `Wallet AUSD ${usd(collateral)}${account ? "" : " · no Perpl account yet, the first order creates one"}`;
    ui.updated.textContent = new Date().toLocaleTimeString();
    renderDesk();
  }

  function renderAll() {
    renderMarkets();
    renderMarketHead();
    renderTicketSize();
  }
  rerender = renderMarkets;

  document.querySelectorAll<HTMLButtonElement>("[data-side]").forEach((button) =>
    button.addEventListener("click", () => {
      side = button.dataset.side as Side;
      document
        .querySelectorAll<HTMLButtonElement>("[data-side]")
        .forEach((b) => b.classList.toggle("chip--active", b === button));
      renderMarketHead();
      renderTicketSize();
    }),
  );
  ui.margin.addEventListener("input", renderTicketSize);
  ui.leverage.addEventListener("input", renderTicketSize);
  query<HTMLButtonElement>("[data-trade-refresh]").addEventListener("click", () => void refresh().catch(() => {}));

  ui.submit.addEventListener("click", async () => {
    const sizing = currentSizing();
    if (!sizing || sizing.sized.legs.length === 0) {
      say(ui.status, sizing?.issues[0]?.detail ?? "Enter a margin amount.", "error");
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
  await refresh().catch((error) => say(ui.deskStatus, errorText(error), "error"));
}
