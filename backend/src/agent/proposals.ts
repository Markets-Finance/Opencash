import { randomUUID } from "node:crypto";
import { JsonFileStore } from "../store/jsonFile.js";
import type { Proposal } from "./types.js";

const store = new JsonFileStore<Proposal>("data/proposals.json");

export async function saveProposal(
  input: Omit<Proposal, "id" | "createdAt">,
): Promise<Proposal> {
  const proposal: Proposal = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await store.set(proposal.id, proposal);
  return proposal;
}

export function getProposal(id: string): Promise<Proposal | undefined> {
  return store.get(id);
}
