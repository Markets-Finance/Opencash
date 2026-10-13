import { referralMessage } from "../bots/mandate.js";
import type { TradingAccount } from "./account.js";

export async function redeemReferral(backend: string, trader: TradingAccount, code: string): Promise<{ gasSent: boolean; gasOver: boolean }> {
  const issuedAt = Date.now();
  const signature = await trader.account.signMessage({ message: referralMessage(trader.address, code, issuedAt) });
  const response = await fetch(`${backend}/referral/redeem`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ owner: trader.address, code, issuedAt, signature }),
  });
  const body = (await response.json().catch(() => ({}))) as { error?: string; gas?: { sent?: boolean; reason?: string } };
  if (!response.ok) throw new Error(body.error ?? `Server ${response.status}`);
  const sent = body.gas?.sent === true;
  const settled = body.gas?.reason === "already has gas" || body.gas?.reason === "already redeemed";
  return { gasSent: sent, gasOver: !sent && !settled };
}

export async function checkReferral(backend: string, code: string): Promise<void> {
  const response = await fetch(`${backend}/referral/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? `Server ${response.status}`);
}

export async function isUnlocked(backend: string, owner: string): Promise<boolean> {
  const response = await fetch(`${backend}/referral/${owner}`).catch(() => null);
  if (!response?.ok) return false;
  return ((await response.json()) as { unlocked?: boolean }).unlocked === true;
}
