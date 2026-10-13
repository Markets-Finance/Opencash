import { vaultDigest, vaultWriteMessage } from "../bots/mandate.js";
import { parseSealedRecord } from "./namespace.js";
import type { TradingAccount } from "./account.js";

export const notesNamespace = "opencash.notes.v1";

export async function saveVault(backend: string, trader: TradingAccount, namespace: string, plaintext: string): Promise<void> {
  const record = trader.seal(namespace, plaintext);
  const issuedAt = Date.now();
  const message = vaultWriteMessage(trader.address, namespace, vaultDigest(record), issuedAt);
  const signature = await trader.account.signMessage({ message });
  const response = await fetch(`${backend}/vault/${trader.address}/${namespace}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ record, issuedAt, signature }),
  });
  if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? `Server ${response.status}`);
}

export async function loadVault(backend: string, trader: TradingAccount, namespace: string): Promise<string | null> {
  const response = await fetch(`${backend}/vault/${trader.address}/${namespace}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Server ${response.status}`);
  const body = (await response.json()) as { record: unknown };
  return trader.open(namespace, parseSealedRecord(body.record));
}
