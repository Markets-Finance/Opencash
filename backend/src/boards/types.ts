import type { Address } from "viem";

export type Board = {
  id: string;
  owner: Address;
  name: string;
  binIds: string[];
  createdAt: string;
  updatedAt: string;
};
