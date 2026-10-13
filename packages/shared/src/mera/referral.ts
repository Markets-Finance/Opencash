import { referralMessage } from "../bots/mandate.js";
import type { TradingAccount } from "./account.js";

export async function redeemReferral(backend: string, trader: TradingAccount, code: string): Promise<void> {
  const issuedAt = Date.now();
  const signature = await trader.account.signMessage({ message: referralMessage(trader.address, code, issuedAt) });
  const response = await fetch(`${backend}/referral/redeem`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ owner: trader.address, code, issuedAt, signature }),
  });
  if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? `Server ${response.status}`);
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
