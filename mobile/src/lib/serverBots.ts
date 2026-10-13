import { botActionMessage, botDigest, botMandateMessage, type Bot, type BotAction, type BotMode } from "shared";
import { currentTrader } from "./bots";
import { backendUrl } from "./config";
import { network } from "./network";

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
