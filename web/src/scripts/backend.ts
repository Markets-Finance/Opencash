import type { Address } from "viem";

// Dev-only: the backend isn't deployed anywhere yet. Run it locally
// (`pnpm --filter backend dev`) alongside `pnpm --filter web dev`.
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
