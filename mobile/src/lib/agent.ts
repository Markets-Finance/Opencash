import {
  agentSessionScope,
  defaultSessionDurationSeconds,
  delegateAddress,
  delegatesTo,
  openCashDelegateAbi,
  sessionRequest,
  type TradingAccount,
} from "shared";
import type { Address, Hash, PublicClient } from "viem";
import { publicClient, walletClientFor } from "./mera";

const client = publicClient as unknown as PublicClient;

export type AgentSession = {
  expiry: bigint;
  revoked: boolean;
  active: boolean;
};

export function requireDelegateAddress(): Address {
  if (!delegateAddress) {
    throw new Error("The OpenCashDelegate contract has not been deployed yet.");
  }
  return delegateAddress;
}

export async function isDelegated(owner: Address): Promise<boolean> {
  const target = requireDelegateAddress();
  const code = await client.getCode({ address: owner });
  return delegatesTo(code, target);
}

export async function readAgentSession(
  owner: Address,
  agentKey: Address,
): Promise<AgentSession> {
  const [expiry, revoked] = await client.readContract({
    address: owner,
    ...sessionRequest(agentKey),
  });
  const now = BigInt(Math.floor(Date.now() / 1000));
  return { expiry, revoked, active: !revoked && expiry > now };
}

export function scopeSummary(): string[] {
  const { targets } = agentSessionScope();
  return [
    `Approve USDG spending on the USDG contract (${targets[0]})`,
    `Batch-swap USDG into bin legs on the Uniswap router (${targets[1]})`,
  ];
}

export async function authorizeAgent(
  tradingAccount: TradingAccount,
  agentKey: Address,
  durationSeconds: number = defaultSessionDurationSeconds,
): Promise<Hash> {
  const target = requireDelegateAddress();
  const wallet = walletClientFor(tradingAccount);
  const expiry = Math.floor(Date.now() / 1000) + durationSeconds;

  const alreadyDelegated = await isDelegated(tradingAccount.address);
  const authorizationList = alreadyDelegated
    ? undefined
    : [await wallet.signAuthorization({ contractAddress: target, executor: "self" })];

  const scope = agentSessionScope();

  return wallet.writeContract({
    address: tradingAccount.address,
    abi: openCashDelegateAbi,
    functionName: "authorizeSession",
    args: [agentKey, BigInt(expiry), scope.targets, scope.selectors],
    chain: wallet.chain,
    account: tradingAccount.account,
    authorizationList,
  });
}

export async function revokeAgent(
  tradingAccount: TradingAccount,
  agentKey: Address,
): Promise<Hash> {
  const wallet = walletClientFor(tradingAccount);
  return wallet.writeContract({
    address: tradingAccount.address,
    abi: openCashDelegateAbi,
    functionName: "revokeSession",
    args: [agentKey],
    chain: wallet.chain,
    account: tradingAccount.account,
  });
}
