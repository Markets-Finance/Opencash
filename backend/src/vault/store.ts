import type { SealedRecord } from "shared";
import { JsonFileStore } from "../store/jsonFile.js";
import { NeonStore } from "../store/neon.js";

export type VaultDoc = { owner: string; namespace: string; record: SealedRecord; updatedAt: number };

const store = process.env.DATABASE_URL ? new NeonStore<VaultDoc>("vault") : new JsonFileStore<VaultDoc>("data/vault.json");

const idOf = (owner: string, namespace: string) => `${owner.toLowerCase()}:${namespace}`;

export const getVault = (owner: string, namespace: string) => store.get(idOf(owner, namespace));

export const putVault = (doc: VaultDoc) => store.set(idOf(doc.owner, doc.namespace), { ...doc, owner: doc.owner.toLowerCase() });

export async function deleteVaultFor(owner: string): Promise<number> {
  const mine = (await store.all()).filter((doc) => doc.owner.toLowerCase() === owner.toLowerCase());
  for (const doc of mine) await store.delete(idOf(doc.owner, doc.namespace));
  return mine.length;
}
