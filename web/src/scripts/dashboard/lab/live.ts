import { botMandateMessage, templates, tradeKeyMessage } from "shared";
import { network } from "../../../data/network";
import { changeClass, esc, query, usd } from "../dom";
import { requireTrader } from "../state";
import { terminal } from "../../perpl";

const backend = import.meta.env.PUBLIC_BACKEND_URL ?? "http://localhost:8787";
export const liveNetwork = network;
const refreshMs = 15_000;
const frames: Record<number, string> = { 3600: "1h", 14400: "4h", 86400: "1d" };

type Metrics = {
  fills: number;
  volumeUsd: number;
  feesUsd: number;
  realizedUsd: number;
  unrealizedUsd: number;
  netUsd: number;
  returnPct: number;
  positionSize: number;
  entryPx: number | null;
  indexedHours: number;
};

type PublicLive = Omit<templates.LiveBot, "journal"> & { candlesSeen: number; metrics: Metrics | null };

export type Preflight = { ready: boolean; checks: { name: string; ok: boolean; detail: string }[]; intents: string[] };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${backend}${path}`, init);
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function turnOnServerRunning(onStep: (text: string) => void): Promise<void> {
  const trader = requireTrader();
  const perplAccount = await terminal.loadAccount(trader.address).catch(() => undefined);
  if (perplAccount === null) {
    throw new Error("You do not have a Perpl account yet. Move at least $10 of AUSD into Perpl first (Account, Move between accounts, Wallet to Perpl). That creates it. Then turn on server running again.");
  }
  onStep("Asking Perpl for a trading key…");
  const start = await post<{ id: string; signing: Record<string, unknown> }>("/bots/enroll/start", { owner: trader.address, network: liveNetwork });
  onStep("Approve once with your passkey…");
  const signature = await trader.account.signTypedData(start.signing as never);
  onStep("Saving…");
  const done = await post<{ ok: true; forwarding: boolean | null }>("/bots/enroll/finish", { id: start.id, signature });
  if (done.forwarding === true) return;
  onStep("Allowing server orders (one small network fee)…");
  try {
    await terminal.enableOrderForwarding(trader);
  } catch (error) {
    throw new Error(`Open a position first so you have a Perpl account, then try again. (${error instanceof Error ? error.message.slice(0, 120) : String(error)})`);
  }
}

export async function saveTradeKey(apiKey: string, secret: string): Promise<void> {
  const trader = requireTrader();
  const issuedAt = Date.now();
  const signature = await trader.account.signMessage({ message: tradeKeyMessage(trader.address, liveNetwork, apiKey, issuedAt) });
  await post("/bots/key", { owner: trader.address, network: liveNetwork, apiKey, secret, issuedAt, signature });
}

export async function liveAct(id: string, action: templates.LiveAction): Promise<void> {
  const issuedAt = Date.now();
  const signature = await requireTrader().account.signMessage({ message: templates.liveActionMessage(id, action, issuedAt) });
  await post(`/live/${id}/${action}`, { issuedAt, signature });
}

export async function reviewLive(spec: templates.LiveSpec): Promise<{ id: string; preflight: Preflight }> {
  const trader = requireTrader();
  const issuedAt = Date.now();
  const signature = await trader.account.signMessage({ message: botMandateMessage(trader.address, liveNetwork, templates.liveDigest(spec), issuedAt) });
  const bot = await post<{ id: string }>("/live", { owner: trader.address, network: liveNetwork, ...spec, issuedAt, signature });
  return { id: bot.id, preflight: await call<Preflight>(`/live/${bot.id}/preflight`) };
}

export async function stopAllBots(close: boolean): Promise<string> {
  const trader = requireTrader();
  const issuedAt = Date.now();
  const signature = await trader.account.signMessage({ message: templates.liveStopAllMessage(trader.address, liveNetwork, close, issuedAt) });
  const result = await post<{ liveStopped: number; cardBotsStopped: number; failures: string[]; note: string }>("/live/stop-all", { owner: trader.address, network: liveNetwork, close, issuedAt, signature });
  const failed = result.failures.length > 0 ? ` Problems: ${result.failures.join("; ")}` : "";
  return `Stopped ${result.liveStopped} live and ${result.cardBotsStopped} server bot${result.cardBotsStopped === 1 ? "" : "s"}. ${result.note}${failed}`;
}

export function renderPreflight(preflight: Preflight): string {
  const checks = preflight.checks.map((c) => `<li class="${c.ok ? "" : "live__check--fail"}">${c.ok ? "✓" : "✕"} ${esc(c.name)}: ${esc(c.detail)}</li>`).join("");
  const intents = preflight.intents.length === 0 ? `<li>Nothing on the latest candle. It acts when its signal appears.</li>` : preflight.intents.map((i) => `<li>${esc(i)}</li>`).join("");
  return `<div class="live__review">
    <b>Checks</b><ul>${checks}</ul>
    <b>What it would do on the latest candle</b><ul>${intents}</ul>
    <p class="run__text">This was a dry run. Nothing was sent.</p>
  </div>`;
}

function stat(label: string, value: string, tone = ""): string {
  return `<div class="live__stat"><small>${label}</small><b class="${tone}">${value}</b></div>`;
}

function px(value: number | null): string {
  return value === null ? "—" : Number(value.toPrecision(6)).toLocaleString();
}

function renderLive(bot: PublicLive): string {
  const m = bot.metrics;
  const stats = [
    ...(m
      ? [
          stat("Net", `${usd(m.netUsd)} · ${m.returnPct.toFixed(1)}%`, changeClass(m.netUsd)),
          stat("Realised", usd(m.realizedUsd), changeClass(m.realizedUsd)),
          stat("Open PnL", usd(m.unrealizedUsd), changeClass(m.unrealizedUsd)),
          stat("Fees", usd(m.feesUsd)),
          stat("Fills", String(m.fills)),
          stat("Position", m.positionSize === 0 ? "Flat" : `${m.positionSize} @ ${px(m.entryPx)}`),
        ]
      : []),
    stat("Orders sent", String(bot.orders)),
    stat("Stop", bot.declaredStop === null ? "None" : `${px(bot.declaredStop)} · server-watched`),
  ].join("");
  const log = bot.log.length === 0
    ? `<div class="bot__log-row">No activity yet.</div>`
    : bot.log.slice(0, 8).map((e) => `<div class="bot__log-row bot__log-row--${e.level}"><span>${new Date(e.at).toLocaleTimeString()}</span><span>${esc(e.message)}</span></div>`).join("");
  return `<div class="bot card" data-live="${esc(bot.id)}">
    <div class="bot__head">
      <span class="bot__name">${esc(bot.name)}</span>
      <span class="pill">${frames[bot.resolution] ?? `${bot.resolution}s`}</span>
      <span class="pill pill--${bot.status}">${bot.status}</span>
      <span class="bot__spacer"></span>
      ${bot.enabled ? `<button type="button" class="btn" data-live-action="pause">Pause</button>` : `<button type="button" class="btn btn--primary" data-live-action="enable">${bot.startedAt ? "Resume" : "Start"}</button>`}
      <button type="button" class="btn" data-live-action="close">Stop and close</button>
      <button type="button" class="link-btn" data-live-dry>Dry run</button>
      <button type="button" class="link-btn" data-live-action="remove">Remove</button>
    </div>
    <div class="bot__meta">
      <span>Allocation ${usd(bot.allocationUsd)} up to ${bot.leverage}x</span>
      <span>${bot.candlesSeen} candles run</span>
      ${m ? `<span>Realised covers the last ${m.indexedHours} h of indexed Perpl events</span>` : ""}
      ${bot.lastCheck ? `<span>Checked ${new Date(bot.lastCheck.at).toLocaleTimeString()}: ${esc(bot.lastCheck.message)}</span>` : ""}
    </div>
    <div class="live__stats">${stats}</div>
    <div data-live-dry-out></div>
    <div class="bot__log">${log}</div>
  </div>`;
}

export async function paintLiveBots(): Promise<void> {
  const host = query("[data-live-bot-list]");
  try {
    const { bots, runner, hasKey } = await call<{ bots: PublicLive[]; runner: boolean; hasKey: boolean }>(`/live?owner=${requireTrader().address}&network=${liveNetwork}`);
    query("[data-trade-key-state]").textContent = hasKey ? "Server running is on. Your bots keep working when this page is closed." : "Turn on server running so your bots keep working when this page is closed. It takes one passkey approval.";
    query<HTMLButtonElement>("[data-server-run]").hidden = hasKey;
    const off = runner ? "" : `<p class="empty">The server runner is off, so live bots will not act.</p>`;
    host.innerHTML = off + (bots.length === 0 ? `<p class="empty">No live strategies yet. Start one from the Strategy Lab, Live stage.</p>` : bots.map(renderLive).join(""));
  } catch (error) {
    host.innerHTML = `<p class="empty">${esc(error instanceof Error ? error.message : String(error))}</p>`;
  }
}

const confirms: Partial<Record<templates.LiveAction, string>> = {
  close: "Stop this bot and close its position at market?",
  remove: "Remove this bot? Anything it has open is closed at market first.",
};

export function initLiveBots(onError: (error: unknown) => void, onNote: (text: string) => void) {
  const host = query("[data-live-bot-list]");
  host.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const root = target.closest<HTMLElement>("[data-live]");
    if (!root) return;
    const id = root.dataset.live!;
    try {
      const actionButton = target.closest<HTMLElement>("[data-live-action]");
      if (actionButton) {
        const action = actionButton.dataset.liveAction as templates.LiveAction;
        if (confirms[action] && !window.confirm(confirms[action])) return;
        actionButton.setAttribute("disabled", "");
        await liveAct(id, action);
        await paintLiveBots();
      }
      if (target.closest("[data-live-dry]")) {
        const out = root.querySelector<HTMLElement>("[data-live-dry-out]")!;
        out.innerHTML = `<p class="run__text">Running a dry run…</p>`;
        out.innerHTML = renderPreflight(await call<Preflight>(`/live/${id}/preflight`));
      }
    } catch (error) {
      onError(error);
      await paintLiveBots();
    }
  });
  query("[data-live-stop-all]").addEventListener("click", async () => {
    try {
      if (!window.confirm("Pause every bot? Positions stay open, and nothing watches their stops while paused.")) return;
      onNote(await stopAllBots(false));
      await paintLiveBots();
    } catch (error) {
      onError(error);
    }
  });
  query("[data-live-close-all]").addEventListener("click", async () => {
    try {
      if (!window.confirm("Stop every bot and close all bot positions at market?")) return;
      onNote(await stopAllBots(true));
      await paintLiveBots();
    } catch (error) {
      onError(error);
    }
  });
  const runButton = query<HTMLButtonElement>("[data-server-run]");
  const runStatus = query("[data-server-run-status]");
  runButton.addEventListener("click", async () => {
    runButton.disabled = true;
    runStatus.dataset.tone = "";
    try {
      await turnOnServerRunning((text) => (runStatus.textContent = text));
      runStatus.textContent = "Server running is on.";
      await paintLiveBots();
    } catch (error) {
      runStatus.dataset.tone = "error";
      runStatus.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      runButton.disabled = false;
    }
  });
}

export function startLiveBots() {
  void paintLiveBots();
  setInterval(() => void paintLiveBots(), refreshMs);
}
