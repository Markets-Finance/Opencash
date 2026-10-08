import { avatars, errorText, esc, markForSymbol, px, query } from "../dom";
import { ago, compact, pct, shortAddress, signedUsd, tone } from "./format";

type Position = {
  symbol: string;
  side: "long" | "short";
  lots: number;
  notionalUsd: number;
  entryPrice: number;
  markPrice: number;
  marginUsd: number;
  leverage: number | null;
  unrealizedPnlUsd: number;
  liquidationPrice: number | null;
  liquidationDistancePct: number | null;
};

type Stats = {
  netPnlUsd: number;
  grossPnlUsd: number;
  fundingUsd: number;
  feesUsd: number;
  volumeUsd: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number | null;
  maxDrawdownUsd: number;
  liquidations: number;
  streak: number;
  bestWinStreak: number;
  worstLossStreak: number;
  bestTradeUsd: number;
  worstTradeUsd: number;
  avgHoldSec: number | null;
};

type Activity = { t: number; kind: "fill" | "pnl"; symbol: string | null; volumeUsd: number | null; feeUsd: number | null; maker: boolean | null; pnlUsd: number | null; closed: boolean | null; liquidated: boolean | null };

export type Wallet =
  | { found: false; address: string }
  | { found: true; network: string; address: string; accountId: number; balanceUsd: number; equityUsd: number; unrealizedPnlUsd: number; badges: { equity: string; pnl: string }; positions: Position[]; stats: Stats | null; activity: Activity[]; indexedHours: number; backfilling: boolean; bySymbol: { symbol: string; pnlUsd: number; closes: number; winRate: number }[] };

const watchKey = "opencash.watch";
const explorers: Record<string, string> = { mainnet: "https://monadscan.com/address/", testnet: "https://testnet.monadexplorer.com/address/" };

let network = "mainnet";
let backend = "";
let current: string | null = null;
const cache = new Map<string, { at: number; wallet: Wallet }>();
const compareSet = new Set<string>();

function watchList(): string[] {
  try {
    return JSON.parse(localStorage.getItem(watchKey) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function saveWatch(list: string[]) {
  try {
    localStorage.setItem(watchKey, JSON.stringify(list));
  } catch {
    return;
  }
}

async function fetchWallet(address: string): Promise<Wallet> {
  const key = `${network}:${address.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 45_000) return hit.wallet;
  const response = await fetch(`${backend}/analytics/wallet?network=${network}&address=${encodeURIComponent(address)}`);
  const body = (await response.json()) as Wallet & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Lookup failed (${response.status})`);
  cache.set(key, { at: Date.now(), wallet: body });
  return body;
}

function stat(label: string, value: string, sub = "", cls = ""): string {
  return `<div class="stat"><small>${label}</small><b class="${cls}">${value}</b>${sub ? `<em>${sub}</em>` : ""}</div>`;
}

function metrics(wallet: Extract<Wallet, { found: true }>): string {
  const s = wallet.stats;
  const hold = wallet.indexedHours > 0 ? `last ${wallet.indexedHours}h indexed${wallet.backfilling ? ", still filling" : ""}` : "nothing indexed yet";
  return [
    stat("Equity", compact(wallet.equityUsd), `free ${compact(wallet.balanceUsd)}`),
    stat("Unrealised PnL", signedUsd(wallet.unrealizedPnlUsd), `${wallet.positions.length} open`, `delta-text--${tone(wallet.unrealizedPnlUsd)}`),
    stat("Realised PnL", s ? signedUsd(s.netPnlUsd) : "—", hold, s ? `delta-text--${tone(s.netPnlUsd)}` : ""),
    stat("Win rate", s && s.closedTrades > 0 ? `${(s.winRate * 100).toFixed(0)}%` : "—", s ? `${s.wins} wins · ${s.losses} losses` : hold),
    stat("Profit factor", s?.profitFactor ? s.profitFactor.toFixed(2) : "—", "gross wins ÷ gross losses"),
    stat("Max drawdown", s ? compact(s.maxDrawdownUsd) : "—", "peak to trough, realised"),
    stat("Volume", s ? compact(s.volumeUsd) : "—", `${s?.closedTrades ?? 0} closed trades`),
    stat("Fees paid", s ? compact(s.feesUsd) : "—", s ? `funding ${signedUsd(s.fundingUsd)}` : hold),
    stat("Liquidations", String(s?.liquidations ?? 0), hold),
    stat("Streak", s && s.closedTrades > 0 ? `${s.streak >= 0 ? "+" : "−"}${Math.abs(s.streak)}` : "—", s ? `best ${s.bestWinStreak} wins · worst ${s.worstLossStreak} losses` : hold, s ? `delta-text--${tone(s.streak)}` : ""),
    stat("Avg hold (approx.)", s?.avgHoldSec ? duration(s.avgHoldSec) : "—", "open to close, indexed trades"),
    stat("Best · worst trade", s && s.closedTrades > 0 ? `${signedUsd(s.bestTradeUsd)} · ${signedUsd(s.worstTradeUsd)}` : "—", "after funding"),
  ].join("");
}

function duration(seconds: number): string {
  if (seconds < 90) return `${Math.round(seconds)}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)}m`;
  if (seconds < 172_800) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86_400).toFixed(1)}d`;
}

function marketsTable(rows: { symbol: string; pnlUsd: number; closes: number; winRate: number }[]): string {
  if (rows.length === 0) return `<p class="empty">No closed trades indexed yet.</p>`;
  const body = rows
    .map((row) => `<tr><td><div class="cell-identity">${markForSymbol(row.symbol)}<b>${esc(row.symbol)}</b></div></td><td class="is-right"><span class="delta delta--${tone(row.pnlUsd)}">${signedUsd(row.pnlUsd)}</span></td><td class="is-right">${row.closes}</td><td class="is-right">${(row.winRate * 100).toFixed(0)}%</td></tr>`)
    .join("");
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Market</th><th class="is-right">Realised PnL</th><th class="is-right">Closed</th><th class="is-right">Win rate</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function positionsTable(positions: Position[]): string {
  if (positions.length === 0) return `<p class="empty">No open positions.</p>`;
  const rows = positions
    .map(
      (p) => `<tr class="board-row" data-open-asset="${esc(p.symbol)}">
      <td><div class="cell-identity">${markForSymbol(p.symbol)}<span class="cell-stack"><b>${esc(p.symbol)}</b><small class="side side--${p.side}">${p.side}</small></span></div></td>
      <td class="is-right">${compact(p.notionalUsd)}</td>
      <td class="is-right">${px(p.entryPrice)}</td>
      <td class="is-right">${px(p.markPrice)}</td>
      <td class="is-right">${p.leverage === null ? "—" : `${p.leverage.toFixed(1)}x`}</td>
      <td class="is-right"><span class="delta delta--${tone(p.unrealizedPnlUsd)}">${signedUsd(p.unrealizedPnlUsd)}</span></td>
      <td class="is-right">${p.liquidationPrice === null ? "—" : `${px(p.liquidationPrice)}<small class="sub">${p.liquidationDistancePct === null ? "" : `${p.liquidationDistancePct.toFixed(1)}% away`}</small>`}</td>
    </tr>`,
    )
    .join("");
  return `<div class="table-wrap"><table class="data-table board-table"><thead><tr><th>Market</th><th class="is-right">Size</th><th class="is-right">Entry</th><th class="is-right">Mark</th><th class="is-right">Leverage</th><th class="is-right">Unrealised</th><th class="is-right">Liquidation (est.)</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function activityList(activity: Activity[], hours: number): string {
  if (activity.length === 0) return `<p class="empty">No trades indexed for this wallet yet. History builds from the first time the index sees it${hours > 0 ? ` (${hours}h so far)` : ""}.</p>`;
  return `<div class="feed">${activity
    .slice(0, 30)
    .map((a) => {
      const label = a.kind === "pnl" ? (a.liquidated ? "Liquidated" : a.closed ? "Closed" : "Reduced") : a.maker ? "Maker fill" : "Taker fill";
      const value = a.kind === "pnl" ? `<span class="delta delta--${tone(a.pnlUsd ?? 0)}">${signedUsd(a.pnlUsd ?? 0)}</span>` : `${compact(a.volumeUsd ?? 0)}<small class="sub">fee ${compact(a.feeUsd ?? 0)}</small>`;
      return `<div class="feed__row${a.liquidated ? " feed__row--bad" : ""}"><span class="feed__time">${ago(a.t)}</span><span class="feed__what"><b>${esc(a.symbol ?? "")}</b> ${label}</span><span class="feed__val">${value}</span></div>`;
    })
    .join("")}</div>`;
}

async function paintProfile(wallet: Wallet) {
  const host = query("[data-an-wallet]");
  if (!wallet.found) {
    host.innerHTML = `<div class="card"><p class="empty">${esc(shortAddress(wallet.address))} has no Perpl account on ${network}. Try another address.</p></div>`;
    return;
  }
  const { avatarDataUri, avatarSeed } = await avatars();
  const watched = watchList().includes(wallet.address.toLowerCase());
  host.innerHTML = `
    <div class="card profile">
      <div class="profile__head">
        <img class="profile__avatar" src="${avatarDataUri(avatarSeed(wallet.address, 0))}" alt="" width="56" height="56" />
        <div class="profile__id">
          <b>${esc(shortAddress(wallet.address))}</b>
          <span class="profile__badges"><i class="badge badge--size">${esc(wallet.badges.equity)}</i><i class="badge badge--pnl-${esc(wallet.badges.pnl.toLowerCase())}">${esc(wallet.badges.pnl)}</i><small>account ${wallet.accountId}</small></span>
        </div>
        <div class="profile__actions">
          <button type="button" class="btn${watched ? "" : " btn--primary"}" data-an-watch-toggle>${watched ? "Watching ✓" : "Watch"}</button>
          <a class="btn" href="${explorers[network] ?? explorers.mainnet}${wallet.address}" target="_blank" rel="noreferrer">Explorer ↗</a>
        </div>
      </div>
      <div class="stat-grid stat-grid--wide">${metrics(wallet)}</div>
    </div>
    <div class="card"><span class="panel__label">Open positions</span>${positionsTable(wallet.positions)}</div>
    <div class="card"><span class="panel__label">Performance by market</span>${marketsTable(wallet.bySymbol)}</div>
    <div class="card"><span class="panel__label">Recent activity</span>${activityList(wallet.activity, wallet.indexedHours)}</div>`;
  host.querySelector("[data-an-watch-toggle]")!.addEventListener("click", () => {
    const list = watchList();
    const key = wallet.address.toLowerCase();
    saveWatch(list.includes(key) ? list.filter((a) => a !== key) : [...list, key]);
    void paintProfile(wallet);
    void paintWatch();
  });
}

export async function paintWatch() {
  const list = watchList();
  const host = query("[data-an-watch]");
  if (list.length === 0) {
    host.innerHTML = "";
    query("[data-an-compare]").innerHTML = "";
    return;
  }
  const wallets = await Promise.all(list.map((address) => fetchWallet(address).catch(() => ({ found: false, address }) as Wallet)));
  host.innerHTML = `<span class="panel__label">Watching</span><div class="watch-row">${wallets
    .map((w) => {
      const key = w.address.toLowerCase();
      const body = w.found
        ? `<span class="watch__eq">${compact(w.equityUsd)}</span><span class="delta delta--${tone(w.unrealizedPnlUsd)}">${signedUsd(w.unrealizedPnlUsd)}</span><i class="badge badge--size">${esc(w.badges.equity)}</i>`
        : `<span class="watch__eq">no account</span>`;
      return `<div class="watch${current === key ? " watch--on" : ""}"><button type="button" class="watch__open" data-an-open="${esc(w.address)}"><b>${esc(shortAddress(w.address))}</b>${body}</button><label class="watch__cmp"><input type="checkbox" data-an-compare-box="${esc(key)}" ${compareSet.has(key) ? "checked" : ""}/> compare</label></div>`;
    })
    .join("")}</div>`;
  paintCompare(wallets);
}

function paintCompare(wallets: Wallet[]) {
  const picked = wallets.filter((w): w is Extract<Wallet, { found: true }> => w.found && compareSet.has(w.address.toLowerCase()));
  const host = query("[data-an-compare]");
  if (picked.length < 2) {
    host.innerHTML = compareSet.size > 0 ? `<p class="panel__lede">Tick at least two watched wallets to compare them side by side.</p>` : "";
    return;
  }
  const rows: [string, (w: (typeof picked)[number]) => string][] = [
    ["Equity", (w) => compact(w.equityUsd)],
    ["Tier", (w) => `${w.badges.equity} · ${w.badges.pnl}`],
    ["Unrealised PnL", (w) => signedUsd(w.unrealizedPnlUsd)],
    ["Open positions", (w) => String(w.positions.length)],
    ["Nearest liquidation", (w) => { const d = w.positions.map((p) => p.liquidationDistancePct).filter((v): v is number => v !== null); return d.length ? `${Math.min(...d).toFixed(1)}% away` : "—"; }],
    ["Realised PnL", (w) => (w.stats ? signedUsd(w.stats.netPnlUsd) : "—")],
    ["Win rate", (w) => (w.stats && w.stats.closedTrades > 0 ? `${(w.stats.winRate * 100).toFixed(0)}%` : "—")],
    ["Profit factor", (w) => (w.stats?.profitFactor ? w.stats.profitFactor.toFixed(2) : "—")],
    ["Max drawdown", (w) => (w.stats ? compact(w.stats.maxDrawdownUsd) : "—")],
    ["Volume", (w) => (w.stats ? compact(w.stats.volumeUsd) : "—")],
    ["Fees paid", (w) => (w.stats ? compact(w.stats.feesUsd) : "—")],
    ["Liquidations", (w) => String(w.stats?.liquidations ?? 0)],
  ];
  host.innerHTML = `<div class="card"><span class="panel__label">Compare</span><div class="table-wrap"><table class="data-table"><thead><tr><th></th>${picked.map((w) => `<th class="is-right">${esc(shortAddress(w.address))}</th>`).join("")}</tr></thead><tbody>${rows.map(([label, fn]) => `<tr><td class="cell-muted">${label}</td>${picked.map((w) => `<td class="is-right">${fn(w)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
}

type BoardRow = { rank: number; accountId: number; address: string | null; netPnlUsd: number; volumeUsd: number; winRate: number; profitFactor: number | null; closedTrades: number; maxDrawdownUsd: number; liquidations: number; tier: string };
type Board = { rows: BoardRow[]; indexedHours: number; targetHours: number; backfilling: boolean; ranked: number; syncedAt: number };

const boardSorts = [
  { key: "pnl", label: "Realised PnL" },
  { key: "volume", label: "Volume" },
  { key: "winRate", label: "Win rate" },
];
let boardSort = "pnl";

export async function showBoard() {
  current = null;
  const host = query("[data-an-wallet]");
  host.innerHTML = `<div class="card"><p class="empty">Loading the leaderboard…</p></div>`;
  try {
    const response = await fetch(`${backend}/analytics/leaderboard?network=${network}&sort=${boardSort}&limit=10`);
    const board = (await response.json()) as Board & { error?: string };
    if (!response.ok) throw new Error(board.error ?? `Leaderboard failed (${response.status})`);
    const span = (hours: number) => (hours >= 48 ? `${(hours / 24).toFixed(1)} days` : `${hours.toFixed(1)} hours`);
    const note = board.backfilling ? `Backfilling history, ${span(board.indexedHours)} of ${span(board.targetHours)} indexed.` : `Ranked from the last ${span(board.indexedHours)} of on-chain trades.`;
    const body = board.rows
      .map(
        (row) => `<tr class="board-row" ${row.address ? `data-an-open="${esc(row.address)}" tabindex="0"` : ""}>
          <td class="cell-muted">#${row.rank}</td>
          <td><b>${row.address ? esc(shortAddress(row.address)) : `account ${row.accountId}`}</b></td>
          <td><i class="badge badge--size">${esc(row.tier)}</i></td>
          <td class="is-right"><span class="delta delta--${tone(row.netPnlUsd)}">${signedUsd(row.netPnlUsd)}</span></td>
          <td class="is-right">${(row.winRate * 100).toFixed(0)}%</td>
          <td class="is-right">${row.profitFactor === null ? "—" : row.profitFactor.toFixed(2)}</td>
          <td class="is-right">${row.closedTrades}</td>
          <td class="is-right">${compact(row.volumeUsd)}</td>
          <td class="is-right">${compact(row.maxDrawdownUsd)}</td>
          <td class="is-right">${row.liquidations}</td>
        </tr>`,
      )
      .join("");
    host.innerHTML = `<div class="card">
      <div class="board-head"><span class="panel__label">Wallet leaderboard</span>
        <div class="chip-row">${boardSorts.map((item) => `<button type="button" class="chip${item.key === boardSort ? " chip--active" : ""}" data-an-board-sort="${item.key}">${item.label}</button>`).join("")}</div>
      </div>
      <p class="panel__lede">${note} Top 10 shown. Tap a wallet to open it.</p>
      <div class="table-wrap">${
        board.rows.length === 0
          ? `<p class="empty">No wallet qualifies yet. The index is still filling.</p>`
          : `<table class="data-table"><thead><tr><th>#</th><th>Wallet</th><th>Tier</th><th class="is-right">Realised PnL</th><th class="is-right">Win rate</th><th class="is-right">Profit factor</th><th class="is-right">Trades</th><th class="is-right">Volume</th><th class="is-right">Max drawdown</th><th class="is-right">Liq.</th></tr></thead><tbody>${body}</tbody></table>`
      }</div></div>`;
  } catch (error) {
    host.innerHTML = `<div class="card"><p class="status-line" data-tone="error">${esc(errorText(error))}</p></div>`;
  }
}

export async function lookup(address: string) {
  const host = query("[data-an-wallet]");
  host.innerHTML = `<div class="card"><p class="empty">Reading ${esc(shortAddress(address))} on ${network}…</p></div>`;
  try {
    const wallet = await fetchWallet(address);
    current = address.toLowerCase();
    await paintProfile(wallet);
    void paintWatch();
  } catch (error) {
    host.innerHTML = `<div class="card"><p class="status-line" data-tone="error">${esc(errorText(error))}</p></div>`;
  }
}

export function initWallet(backendUrl: string, getNetwork: () => string) {
  backend = backendUrl;
  network = getNetwork();
  const form = query<HTMLFormElement>("[data-an-search]");
  const input = query<HTMLInputElement>("[data-an-address]");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    network = getNetwork();
    if (input.value.trim()) void lookup(input.value.trim());
    else void showBoard();
  });
  query("[data-an-board-btn]").addEventListener("click", () => {
    input.value = "";
    void showBoard();
  });
  query("[data-an-wallet]").addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const sort = target.closest<HTMLElement>("[data-an-board-sort]");
    if (sort) {
      boardSort = sort.dataset.anBoardSort!;
      void showBoard();
      return;
    }
    const open = target.closest<HTMLElement>("[data-an-open]");
    if (open) {
      input.value = open.dataset.anOpen!;
      void lookup(open.dataset.anOpen!);
    }
  });
  query("[data-an-watch]").addEventListener("click", (event) => {
    const open = (event.target as HTMLElement).closest<HTMLElement>("[data-an-open]");
    if (open) {
      input.value = open.dataset.anOpen!;
      void lookup(open.dataset.anOpen!);
    }
  });
  query("[data-an-watch]").addEventListener("change", (event) => {
    const box = event.target as HTMLInputElement;
    if (!box.dataset.anCompareBox) return;
    if (box.checked && compareSet.size >= 3) {
      box.checked = false;
      return;
    }
    if (box.checked) compareSet.add(box.dataset.anCompareBox);
    else compareSet.delete(box.dataset.anCompareBox);
    void paintWatch();
  });
  void paintWatch();
  void showBoard();
}

export function setNetwork(next: string) {
  network = next;
  cache.clear();
  void showBoard();
  void paintWatch();
}
