import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hood } from "shared";

export const publicClient = createPublicClient({
  chain: hood,
  transport: http(),
});

// The backend's own hot wallet: pays gas for executeWithSession calls and,
// once a mandate's owner authorizes it on-chain via authorizeSession, signs
// as that session key. One key does both jobs for this MVP.
export function agentAccount() {
  const key = process.env.AGENT_SESSION_KEY;
  if (!key) throw new Error("AGENT_SESSION_KEY is not set");
  return privateKeyToAccount(key as `0x${string}`);
}

export function agentWalletClient() {
  return createWalletClient({
    account: agentAccount(),
    chain: hood,
    transport: http(),
  });
}

export type { Address };
