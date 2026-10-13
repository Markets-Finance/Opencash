import { tradeKeyRemoveMessage } from "shared";
import { stopAllBots } from "./live";
import { backendUrl } from "./config";
import { currentTrader } from "./bots";
import { network } from "./network";
import { terminal } from "./perpl";

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${backendUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const reply = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(reply.error ?? `Request failed (${response.status})`);
  return reply;
}

export async function turnOnServerRunning(onStep: (text: string) => void): Promise<void> {
  const trader = currentTrader();
  if (!trader) throw new Error("Not signed in.");
  const perplAccount = await terminal.loadAccount(trader.address).catch(() => undefined);
  if (perplAccount === null) {
    throw new Error("You do not have a Perpl account yet. Move at least $10 of AUSD into Perpl first (Account, Move between wallet and Perpl, Wallet to Perpl). That creates it. Then turn on server running again.");
  }
  onStep("Asking Perpl for a trading key…");
  const start = await post<{ id: string; signing: Record<string, unknown> }>("/bots/enroll/start", { owner: trader.address, network });
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

export async function turnOffServerRunning(): Promise<void> {
  const trader = currentTrader();
  if (!trader) throw new Error("Not signed in.");
  await stopAllBots(false);
  const issuedAt = Date.now();
  const signature = await trader.account.signMessage({ message: tradeKeyRemoveMessage(trader.address, network, issuedAt) });
  await post("/bots/key/remove", { owner: trader.address, network, issuedAt, signature });
}
