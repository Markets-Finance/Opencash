import { randomUUID } from "node:crypto";
import type { Address } from "viem";
import { JsonFileStore } from "../store/jsonFile.js";
import type { Mandate } from "./types.js";

const store = new JsonFileStore<Mandate>("data/mandates.json");

export async function createMandate(input: {
  binId: string;
  owner: Address;
  policyText: string;
  usdgBudget: number;
  autoExecute?: boolean;
}): Promise<Mandate> {
  const mandate: Mandate = {
    id: randomUUID(),
    binId: input.binId,
    owner: input.owner,
    policyText: input.policyText,
    usdgBudget: input.usdgBudget,
    autoExecute: input.autoExecute ?? false,
    createdAt: new Date().toISOString(),
  };
  await store.set(mandate.id, mandate);
  return mandate;
}

export function getMandate(id: string): Promise<Mandate | undefined> {
  return store.get(id);
}

export function listMandates(): Promise<Mandate[]> {
  return store.all();
}

export async function listMandatesForOwner(owner: Address): Promise<Mandate[]> {
  const all = await store.all();
  return all
    .filter((mandate) => mandate.owner.toLowerCase() === owner.toLowerCase())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
