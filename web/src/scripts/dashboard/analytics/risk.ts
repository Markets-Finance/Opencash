import { errorText, esc, markForSymbol, query } from "../dom";
import { ago, compact, shortAddress, signedUsd, tone } from "./format";

type Liquidations = {
  count: number;
  lossUsd: number;
  hours: { t: number; count: number }[];
  recent: { t: number; symbol: string; accountId: number; address: string | null; lossUsd: number }[];
};

type Row = {
  symbol: string;
  side: "long" | "short";
  notionalUsd: number;
  leverage: number | null;
  unrealizedPnlUsd: number;
  liquidationDistancePct: number | null;
  accountId: number;
  address: string | null;
};

type Positions = { scanned: number; openPositions: number; openNotionalUsd: number; largest: Row[]; nearest: Row[] };

let mode: "largest" | "nearest" = "largest";
let positions: Positions | null = null;

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}

function who(address: string | null, accountId: number): string {
  return address ? `<button type="button" class="link-btn" data-an-lookup="${esc(address)}">${esc(shortAddress(address))}</button>` : `account ${accountId}`;
}

function paintLiquidations(data: Liquidations) {
  query("[data-an-liq-note]").textContent =
    data.count === 0 ? "No liquidations in the indexed window." : `${data.count} liquidation${data.count === 1 ? "" : "s"}, ${compact(data.lossUsd)} lost by the accounts.`;
  const peak = Math.max(...data.hours.map((hour) => hour.count), 1);
  const bars = `<div class="liq-bars" aria-label="Liquidations per hour">${data.hours
    .map((hour) => `<i title="${new Date(hour.t).getHours()}:00 · ${hour.count}" style="height:${Math.max(4, (hour.count / peak) * 100)}%" class="${hour.count > 0 ? "liq-bars__on" : ""}"></i>`)
    .join("")}</div>`;
  const feed =
    data.recent.length === 0
      ? ""
      : `<div class="feed">${data.recent
          .slice(0, 12)
          .map(
            (row) => `<div class="feed__row feed__row--bad"><span class="feed__time">${ago(row.t)}</span><span class="feed__what"><span class="cell-identity">${markForSymbol(row.symbol)}<b>${esc(row.symbol)}</b></span> ${who(row.address, row.accountId)}</span><span class="feed__val"><span class="delta delta--down">${signedUsd(-row.lossUsd)}</span></span></div>`,
          )
          .join("")}</div>`;
  query("[data-an-liq]").innerHTML = `${bars}${feed}`;
}

function distance(row: Row): string {
  const value = row.liquidationDistancePct;
  if (value === null) return "—";
  const level = value < 5 ? "hot" : value < 15 ? "warm" : "ok";
  return `<span class="dist dist--${level}">${value.toFixed(1)}%</span>`;
}

function paintPositions() {
  if (!positions) return;
  const rows = (mode === "largest" ? positions.largest : positions.nearest).slice(0, 12);
  query("[data-an-pos-note]").textContent = `${positions.openPositions} open positions, ${compact(positions.openNotionalUsd)} notional, across the ${positions.scanned} most active wallets.`;
  if (rows.length === 0) {
    query("[data-an-pos]").innerHTML = `<p class="empty">No open positions found.</p>`;
    return;
  }
  const body = rows
    .map(
      (row) => `<tr>
        <td>${who(row.address, row.accountId)}</td>
        <td><div class="cell-identity">${markForSymbol(row.symbol)}<span class="cell-stack"><b>${esc(row.symbol)}</b><small class="side side--${row.side}">${row.side}</small></span></div></td>
        <td class="is-right">${compact(row.notionalUsd)}</td>
        <td class="is-right">${row.leverage === null ? "—" : `${row.leverage.toFixed(1)}x`}</td>
        <td class="is-right"><span class="delta delta--${tone(row.unrealizedPnlUsd)}">${signedUsd(row.unrealizedPnlUsd)}</span></td>
        <td class="is-right">${distance(row)}</td>
      </tr>`,
    )
    .join("");
  query("[data-an-pos]").innerHTML = `<table class="data-table"><thead><tr><th>Wallet</th><th>Market</th><th class="is-right">Size</th><th class="is-right">Leverage</th><th class="is-right">Unrealised</th><th class="is-right">To liquidation</th></tr></thead><tbody>${body}</tbody></table>`;
}

export async function loadRisk(backend: string, network: string) {
  const [liquidations, held] = await Promise.allSettled([
    fetchJson<Liquidations>(`${backend}/analytics/liquidations?network=${network}`),
    fetchJson<Positions>(`${backend}/analytics/positions?network=${network}`),
  ]);
  if (liquidations.status === "fulfilled") paintLiquidations(liquidations.value);
  else query("[data-an-liq]").innerHTML = `<p class="status-line" data-tone="error">${esc(errorText(liquidations.reason))}</p>`;
  if (held.status === "fulfilled") {
    positions = held.value;
    paintPositions();
  } else query("[data-an-pos]").innerHTML = `<p class="status-line" data-tone="error">${esc(errorText(held.reason))}</p>`;
}

export function initRiskControls() {
  query("[data-an-pos-mode]").addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>("[data-pos]");
    if (!button) return;
    mode = button.dataset.pos as typeof mode;
    query("[data-an-pos-mode]").querySelectorAll("[data-pos]").forEach((el) => el.classList.toggle("chip--active", el === button));
    paintPositions();
  });
}
