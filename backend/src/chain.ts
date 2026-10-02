import { createPublicClient, http, type Address } from "viem";
import { hood } from "shared";

export const publicClient = createPublicClient({
  chain: hood,
  transport: http(),
});

export type { Address };
