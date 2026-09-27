import type { Address, Hash } from "viem";

export type Mandate = {
  id: string;
  binId: string;
  owner: Address;
  policyText: string;
  // Lifetime cap across every proposal this mandate ever makes, not a
  // per-tick allowance — watch() runs indefinitely, so a per-tick reading
  // would let autoExecute spend this amount on every interval, forever.
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
  // USDG actually swapped when status is "executed"; 0 otherwise. Summed
  // across a mandate's receipts to enforce the lifetime budget cap.
  usdgAmount: number;
  txHash: Hash | null;
  status: "proposed" | "executed" | "failed";
  detail: string;
  hash: string;
  createdAt: string;
};
