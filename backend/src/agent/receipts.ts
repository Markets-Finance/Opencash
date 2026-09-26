import { createHash, randomUUID } from "node:crypto";
import type { Hash } from "viem";
import { JsonFileStore } from "../store/jsonFile.js";
import type { Receipt } from "./types.js";

const store = new JsonFileStore<Receipt>("data/receipts.json");

// Our own audit anchor: SERV's shadow-agent validation report lives in the
// SERV console, not in the API response, so this repo's receipt is the only
// durable record of what was proposed and what happened to it. IPFS pinning
// and ERC-8004 identity anchoring are the natural next step but are not
// wired up yet.
export async function recordReceipt(input: {
  mandateId: string;
  proposalId: string;
  status: Receipt["status"];
  detail: string;
  txHash?: Hash | null;
}): Promise<Receipt> {
  const payload = {
    mandateId: input.mandateId,
    proposalId: input.proposalId,
    status: input.status,
    detail: input.detail,
    txHash: input.txHash ?? null,
  };
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");

  const receipt: Receipt = {
    id: randomUUID(),
    ...payload,
    hash,
    createdAt: new Date().toISOString(),
  };
  await store.set(receipt.id, receipt);
  return receipt;
}

export function getReceipt(id: string): Promise<Receipt | undefined> {
  return store.get(id);
}

export async function receiptsForMandate(mandateId: string): Promise<Receipt[]> {
  const all = await store.all();
  return all.filter((receipt) => receipt.mandateId === mandateId);
}
