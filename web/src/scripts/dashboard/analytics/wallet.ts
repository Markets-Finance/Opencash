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
};

type Activity = { t: number; kind: "fill" | "pnl"; symbol: string | null; volumeUsd: number | null; feeUsd: number | null; maker: boolean | null; pnlUsd: number | null; closed: boolean | null; liquidated: boolean | null };

export type Wallet =
  | { found: false; address: string }
  | { found: true; network: string; address: string; accountId: number; balanceUsd: number; equityUsd: number; unrealizedPnlUsd: number; badges: { equity: string; pnl: string }; positions: Position[]; stats: Stats | null; activity: Activity[]; indexedHours: number };

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
  const hold = wallet.indexedHours > 0 ? `last ${wallet.indexedHours}h indexed` : "nothing indexed yet";
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
  ].join("");
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
}

export function setNetwork(next: string) {
  network = next;
  cache.clear();
  current = null;
  query("[data-an-wallet]").innerHTML = `<p class="empty">Search any address to see its Perpl positions, risk and trading record.</p>`;
  void paintWatch();
}
