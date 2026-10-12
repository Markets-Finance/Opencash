import { botMandateMessage, templates, tradeKeyMessage } from "shared";
import { currentTrader } from "./bots";
import { backendUrl } from "./config";
import { network } from "./network";

export const liveNetwork = network;

export type LiveMetrics = {
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

export type PublicLive = Omit<templates.LiveBot, "journal"> & { candlesSeen: number; metrics: LiveMetrics | null };
export type Preflight = { ready: boolean; checks: { name: string; ok: boolean; detail: string }[]; intents: string[] };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, init);
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function signer() {
  const trader = currentTrader();
  if (!trader) throw new Error("Not signed in.");
  return trader;
}

export function loadLive(): Promise<{ bots: PublicLive[]; runner: boolean; hasKey: boolean }> {
  return call(`/live?owner=${signer().address}&network=${liveNetwork}`);
}

export function preflightLive(id: string): Promise<Preflight> {
  return call(`/live/${id}/preflight`);
}

export async function saveTradeKey(apiKey: string, secret: string): Promise<void> {
  const trader = signer();
  const issuedAt = Date.now();
  const signature = await trader.account.signMessage({ message: tradeKeyMessage(trader.address, liveNetwork, apiKey, issuedAt) });
  await post("/bots/key", { owner: trader.address, network: liveNetwork, apiKey, secret, issuedAt, signature });
}

export async function reviewLive(spec: templates.LiveSpec): Promise<{ id: string; preflight: Preflight }> {
  const trader = signer();
  const issuedAt = Date.now();
  const signature = await trader.account.signMessage({ message: botMandateMessage(trader.address, liveNetwork, templates.liveDigest(spec), issuedAt) });
  const bot = await post<{ id: string }>("/live", { owner: trader.address, network: liveNetwork, ...spec, issuedAt, signature });
  return { id: bot.id, preflight: await preflightLive(bot.id) };
}

export async function liveAct(id: string, action: templates.LiveAction): Promise<void> {
  const issuedAt = Date.now();
  const signature = await signer().account.signMessage({ message: templates.liveActionMessage(id, action, issuedAt) });
  await post(`/live/${id}/${action}`, { issuedAt, signature });
}

export async function stopAllBots(close: boolean): Promise<string> {
  const trader = signer();
  const issuedAt = Date.now();
  const signature = await trader.account.signMessage({ message: templates.liveStopAllMessage(trader.address, liveNetwork, close, issuedAt) });
  const result = await post<{ liveStopped: number; cardBotsStopped: number; failures: string[]; note: string }>("/live/stop-all", { owner: trader.address, network: liveNetwork, close, issuedAt, signature });
  const failed = result.failures.length > 0 ? ` Problems: ${result.failures.join("; ")}` : "";
  return `Stopped ${result.liveStopped} live and ${result.cardBotsStopped} server bot${result.cardBotsStopped === 1 ? "" : "s"}. ${result.note}${failed}`;
}
