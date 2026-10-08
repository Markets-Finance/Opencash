import { esc, markForSymbol, px, query } from "../dom";
import { drawBars } from "./bars";
import { compact, pct, signedUsd, tone } from "./format";

export type Market = {
  symbol: string;
  name: string;
  mark: number;
  changePct: number;
  volume24h: number;
  volume7d: number;
  volume30d: number;
  volumeAll: number;
  openInterest: number;
  fundingApr: number | null;
  spreadBps: number;
  maxLeverage: number;
  shareVolume: number;
};

export type Protocol = {
  network: string;
  at: number;
  syncedAt: number;
  headline: { volume24h: number; volume7d: number; volume30d: number; volumeAll: number; openInterest: number; tvl: number; accounts: number | null; activeAccounts: number; markets: number };
  window: { hours: number; volumeUsd: number; feesUsd: number; feeRateBps: number | null; depositsUsd: number; withdrawalsUsd: number; liquidations: number; trades: number };
  markets: Market[];
  series: { volumeDaily: { t: number; v: number }[] };
};

let days = 30;
let mode: "daily" | "cumulative" = "daily";
let last: Protocol | null = null;

function tile(label: string, value: string, sub: string, accent = ""): string {
  return `<div class="an-tile ${accent}"><small>${label}</small><b>${value}</b><span>${sub}</span></div>`;
}

function paintHeadline(data: Protocol) {
  const h = data.headline;
  const top = data.markets[0];
  const rate = data.window.feeRateBps;
  const fees = rate === null ? null : (h.volume24h * rate) / 1e4;
  query("[data-an-headline]").innerHTML = [
    tile("24h volume", compact(h.volume24h), top ? `${top.symbol} is ${(top.shareVolume * 100).toFixed(0)}% of it` : "", "an-tile--lime"),
    tile("7d volume", compact(h.volume7d), `${compact(h.volume7d / 7)} a day`),
    tile("30d volume", compact(h.volume30d), `${compact(h.volume30d / 30)} a day`),
    tile("All-time volume", compact(h.volumeAll), `${h.markets} markets`),
    tile("Open interest", compact(h.openInterest), `${(h.volume24h > 0 ? h.volume24h / Math.max(h.openInterest, 1) : 0).toFixed(1)}× turnover today`),
    tile("TVL", compact(h.tvl), "AUSD held by the exchange"),
    tile("Accounts", h.accounts === null ? "—" : h.accounts.toLocaleString(), `${h.activeAccounts} active in the indexed window`),
    tile("Fees, 24h estimate", fees === null ? "—" : compact(fees), rate === null ? "Event index is warming up" : `${rate.toFixed(2)} bps from indexed trades`),
  ].join("");
}

function paintChart(data: Protocol) {
  const all = data.series.volumeDaily;
  const points = days === 0 ? all : all.slice(-days);
  const total = points.reduce((s, p) => s + p.v, 0);
  query("[data-an-chart-note]").textContent = `${compact(total)} over ${points.length} days · daily candles, all ${data.headline.markets} markets`;
  drawBars(query("[data-an-chart]"), points, { cumulative: mode === "cumulative" });
}

function paintMarkets(data: Protocol) {
  const rows = data.markets
    .map(
      (m) => `<tr class="board-row" data-open-asset="${esc(m.symbol)}" tabindex="0">
        <td><div class="cell-identity">${markForSymbol(m.symbol)}<span class="cell-stack"><b>${esc(m.symbol)}</b><small>${esc(m.name)}</small></span></div></td>
        <td class="is-right">${px(m.mark)}</td>
        <td class="is-right"><span class="delta delta--${tone(m.changePct)}">${pct(m.changePct)}</span></td>
        <td class="is-right"><div class="vol-cell"><span>${compact(m.volume24h)}</span><i style="width:${Math.max(2, m.shareVolume * 100)}%"></i></div></td>
        <td class="is-right">${compact(m.volume7d)}</td>
        <td class="is-right">${compact(m.volume30d)}</td>
        <td class="is-right">${compact(m.openInterest)}</td>
        <td class="is-right">${m.fundingApr === null ? "—" : `<span class="delta delta--${tone(-m.fundingApr)}">${pct(m.fundingApr, 1)}</span>`}</td>
        <td class="is-right">${m.spreadBps.toFixed(1)} bps</td>
      </tr>`,
    )
    .join("");
  query("[data-an-markets]").innerHTML = `<table class="data-table board-table"><thead><tr><th>Market</th><th class="is-right">Price</th><th class="is-right">24h</th><th class="is-right">24h volume</th><th class="is-right">7d</th><th class="is-right">30d</th><th class="is-right">Open interest</th><th class="is-right">Funding</th><th class="is-right">Spread</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function paintFunding(data: Protocol) {
  const withFunding = data.markets.filter((m) => m.fundingApr !== null);
  const max = Math.max(...withFunding.map((m) => Math.abs(m.fundingApr!)), 1);
  query("[data-an-funding]").innerHTML = `
    <div class="fund">${withFunding
      .map((m) => {
        const apr = m.fundingApr!;
        const width = (Math.abs(apr) / max) * 50;
        return `<div class="fund__row" data-open-asset="${esc(m.symbol)}"><span class="fund__name">${esc(m.symbol)}</span><span class="fund__track"><i class="fund__bar fund__bar--${apr >= 0 ? "long" : "short"}" style="${apr >= 0 ? `left:50%;width:${width}%` : `right:50%;width:${width}%`}"></i></span><span class="fund__val">${pct(apr, 1)}</span></div>`;
      })
      .join("")}</div>
    <p class="panel__lede">Open interest is balanced by design in an order-book perp, so skew shows up in funding. Coral means longs pay shorts, lime means shorts pay longs.</p>`;
}

function paintFlows(data: Protocol) {
  const w = data.window;
  const net = w.depositsUsd - w.withdrawalsUsd;
  const note = w.hours < 1 ? "The event index is warming up. Flows and liquidations fill in as it syncs." : `Indexed on-chain events from the last ${w.hours} hours.`;
  query("[data-an-flows]").innerHTML = `
    <div class="stat-grid">
      <div class="stat"><small>Deposits</small><b>${compact(w.depositsUsd)}</b></div>
      <div class="stat"><small>Withdrawals</small><b>${compact(w.withdrawalsUsd)}</b></div>
      <div class="stat"><small>Net inflow</small><b class="delta-text--${tone(net)}">${signedUsd(net)}</b></div>
      <div class="stat"><small>Liquidations</small><b>${w.liquidations}</b></div>
      <div class="stat"><small>Trades</small><b>${w.trades.toLocaleString()}</b></div>
      <div class="stat"><small>Fees paid</small><b>${compact(w.feesUsd)}</b></div>
    </div>
    <p class="panel__lede">${note}</p>`;
}

export function paintProtocol(data: Protocol) {
  last = data;
  paintHeadline(data);
  paintChart(data);
  paintMarkets(data);
  paintFunding(data);
  paintFlows(data);
}

export function initProtocolControls() {
  query("[data-an-range]").addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-days]");
    if (!button) return;
    days = Number(button.dataset.days);
    query("[data-an-range]").querySelectorAll("[data-days]").forEach((el) => el.classList.toggle("chip--active", el === button));
    if (last) paintChart(last);
  });
  query("[data-an-mode]").addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-mode]");
    if (!button) return;
    mode = button.dataset.mode as typeof mode;
    query("[data-an-mode]").querySelectorAll("[data-mode]").forEach((el) => el.classList.toggle("chip--active", el === button));
    if (last) paintChart(last);
  });
}
