import { vaultDigest, vaultWriteMessage } from "../bots/mandate.js";
import type { TradingAccount } from "./account.js";
import type { NamespaceSession } from "./journal.js";
import { parseSealedRecord } from "./namespace.js";

export const notesNamespace = "opencash.notes.v2";
export const legacyNotesNamespace = "opencash.notes.v1";
export const agentMemoryNamespace = "opencash.agent.v1";

export async function saveVault(backend: string, trader: TradingAccount, namespace: string, plaintext: string, session?: NamespaceSession): Promise<void> {
  const record = session ? session.seal(plaintext) : trader.seal(namespace, plaintext);
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

export async function vaultExists(backend: string, owner: string, namespace: string): Promise<boolean> {
  const response = await fetch(`${backend}/vault/${owner}/${namespace}`);
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Server ${response.status}`);
  return true;
}

export async function loadVault(backend: string, trader: TradingAccount, namespace: string, session?: NamespaceSession): Promise<string | null> {
  const response = await fetch(`${backend}/vault/${trader.address}/${namespace}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Server ${response.status}`);
  const body = (await response.json()) as { record: unknown };
  const record = parseSealedRecord(body.record);
  return session ? session.open(record) : trader.open(namespace, record);
}
