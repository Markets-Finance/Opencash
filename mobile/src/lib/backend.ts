import type { Address } from "viem";

// Dev-only: the backend isn't deployed anywhere yet. On the Android
// emulator this needs `adb reverse tcp:8787 tcp:8787` (same trick already
// used for Metro on 8081) so "localhost" here resolves to the host machine.
const API_BASE = "http://localhost:8787";

export type Mandate = {
  id: string;
  owner: Address;
  binId: string;
  policyText: string;
  usdgBudget: number;
  autoExecute: boolean;
  createdAt: string;
};

export type Proposal = {
  id: string;
  mandateId: string;
  binId: string;
  usdgAmount: number;
  reasoning: string;
  servFinishReason: string;
  createdAt: string;
};

export type Receipt = {
  id: string;
  mandateId: string;
  proposalId: string;
  usdgAmount: number;
  txHash: string | null;
  status: "proposed" | "executed" | "failed";
  detail: string;
  hash: string;
  createdAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Fastify's JSON body parser rejects an empty body when Content-Type is
  // set to application/json (FST_ERR_CTP_EMPTY_JSON_BODY) — only send the
  // header when there's actually a body, e.g. not on bodyless POSTs.
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error ?? `Request to ${path} failed (${response.status})`);
  }
  return body as T;
}

export function createMandate(input: {
  owner: Address;
  binId: string;
  policyText: string;
  usdgBudget: number;
}): Promise<Mandate> {
  return request("/mandates", { method: "POST", body: JSON.stringify(input) });
}

export function listMandates(owner: Address): Promise<Mandate[]> {
  return request(`/mandates?owner=${owner}`);
}

export function proposeAction(mandateId: string): Promise<Proposal> {
  return request(`/mandates/${mandateId}/propose`, { method: "POST" });
}

export function fetchReceipts(mandateId: string): Promise<Receipt[]> {
  return request(`/mandates/${mandateId}/receipts`);
}
