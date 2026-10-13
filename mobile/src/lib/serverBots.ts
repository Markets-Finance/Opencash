import { botActionMessage, botDigest, botMandateMessage, type Bot, type BotAction, type BotMode } from "shared";
import { currentTrader } from "./bots";
import { backendUrl } from "./config";
import { network } from "./network";
import { loadAccount } from "./perpl";
import { turnOnServerRunning } from "./serverAccess";

export type ServerBotView = Omit<Bot, "mandate">;

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

export function loadServerBots(): Promise<{ bots: ServerBotView[]; hasKey: boolean; runner: boolean }> {
  return call(`/bots?owner=${signer().address}&network=${network}`);
}

export async function createServerBot(card: Bot["card"], mode: BotMode): Promise<ServerBotView> {
  const trader = signer();
  const issuedAt = Date.now();
  const signature = await trader.account.signMessage({ message: botMandateMessage(trader.address, network, botDigest(card, mode), issuedAt) });
  return post("/bots", { owner: trader.address, network, mode, card, issuedAt, signature });
}

export async function actServerBot(id: string, action: BotAction): Promise<void> {
  const issuedAt = Date.now();
  const signature = await signer().account.signMessage({ message: botActionMessage(id, action, issuedAt) });
  await post(`/bots/${id}/${action}`, { issuedAt, signature });
}

export const botMinUsd = 10;

export async function startLiveFromCard(card: Bot["card"], mode: BotMode, onStep: (text: string) => void): Promise<string> {
  const trader = signer();
  const account = await loadAccount(trader.address).catch(() => null);
  const free = account === null ? 0 : account.balance - account.lockedBalance;
  if (free < botMinUsd) throw new Error(`A live bot trades from your Perpl account and needs at least $${botMinUsd} there. You have $${free.toFixed(2)}. Move AUSD in from Account, or test it in Paper first.`);
  if (card.marginUsd > free) throw new Error(`This bot wants $${card.marginUsd} margin but Perpl has $${free.toFixed(2)} free. Lower the margin.`);
  const status = await loadServerBots();
  if (!status.hasKey) await turnOnServerRunning(onStep);
  onStep("Approve the bot with your passkey…");
  const created = await createServerBot(card, mode);
  onStep("Starting it…");
  await actServerBot(created.id, "enable");
  return "Live bot started. It trades from the server, even when the app is closed.";
}

export type ProtectLeg = { symbol: string; direction: "long" | "short"; leverage: number; weightBps: number };

export async function protectPosition(name: string, legs: ProtectLeg[], marginUsd: number, stopLossPct: number, takeProfitPct: number | undefined, onStep: (text: string) => void): Promise<string> {
  const status = await loadServerBots();
  if (!status.hasKey) await turnOnServerRunning(onStep);
  onStep("Approve the protection with your passkey…");
  const card: Bot["card"] = {
    name,
    thesis: "Stop and target on a position you already hold",
    kind: legs.length === 1 ? "directional" : "basket",
    marginUsd,
    legs,
    stopLossPct,
    ...(takeProfitPct !== undefined && legs.length === 1 ? { takeProfitPct } : {}),
  };
  const created = await createServerBot(card, "guard");
  onStep("Placing the stop on Perpl…");
  await actServerBot(created.id, "enable");
  return legs.length > 1 && takeProfitPct !== undefined ? "Stop is on Perpl. A target needs a single-market position, so it was skipped." : "Protection is on. The stop and target now rest on Perpl.";
}
