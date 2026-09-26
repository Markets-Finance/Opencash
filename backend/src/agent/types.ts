import type { Address, Hash } from "viem";

export type Mandate = {
  id: string;
  binId: string;
  owner: Address;
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
  txHash: Hash | null;
  status: "proposed" | "executed" | "failed";
  detail: string;
  hash: string;
  createdAt: string;
};
