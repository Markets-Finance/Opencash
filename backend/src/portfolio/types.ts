import type { Address } from "viem";

export type PortfolioSnapshot = {
  id: string;
  owner: Address;
  usdgBalance: number;
  positionsValue: number;
  totalValue: number;
  createdAt: string;
};
