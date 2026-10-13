import { errorText, esc, query } from "../dom";
import { compact, signedUsd, tone } from "./format";

type Row = { rank: number; address: string; netPnlUsd: number; volumeUsd: number; winRate: number; profitFactor: number | null; closedTrades: number; maxDrawdownUsd: number; liquidations: number; tier: string };

export function initBoard(backend: string, getNetwork: () => string) {
  const host = query("[data-board-rows]");
  const chips = query("[data-board-sort]");
  let sort = "pnl";

  async function load() {
    host.innerHTML = `<p class="empty">Loading…</p>`;
    try {
      const response = await fetch(`${backend}/analytics/leaderboard?network=${getNetwork()}&sort=${sort}&limit=25`);
      const body = (await response.json()) as { rows?: Row[]; error?: string };
      if (!response.ok || !body.rows) throw new Error(body.error ?? `Leaderboard ${response.status}`);
      host.innerHTML = `<table class="data-table"><thead><tr><th>#</th><th>Wallet</th><th>Net P&amp;L</th><th>Volume</th><th>Win rate</th><th>Trades</th><th>Max drawdown</th><th>Tier</th></tr></thead><tbody>${body.rows
        .map(
          (row) =>
            `<tr data-an-lookup="${esc(row.address)}" class="asset-row--link"><td>${row.rank}</td><td>${esc(row.address.slice(0, 6))}…${esc(row.address.slice(-4))}</td><td class="${tone(row.netPnlUsd)}">${signedUsd(row.netPnlUsd)}</td><td>${compact(row.volumeUsd)}</td><td>${(row.winRate * 100).toFixed(0)}%</td><td>${row.closedTrades}</td><td>${compact(row.maxDrawdownUsd)}</td><td>${esc(row.tier)}</td></tr>`,
        )
        .join("")}</tbody></table>`;
    } catch (error) {
      host.innerHTML = `<p class="status-line" data-tone="error">${esc(errorText(error))}</p>`;
    }
  }

  chips.addEventListener("click", (event) => {
    const chip = (event.target as HTMLElement).closest<HTMLElement>("[data-sort]");
    if (!chip) return;
    sort = chip.dataset.sort!;
    chips.querySelectorAll(".chip").forEach((el) => el.classList.toggle("chip--active", el === chip));
    void load();
  });
  document.addEventListener("switcher:change", (event) => {
    const detail = (event as CustomEvent<{ group: string; key: string }>).detail;
    if (detail.group === "an" && detail.key === "board") void load();
  });
}
