import { toFunctionSelector, type Address, type Hex } from "viem";
import { hoodMainnet } from "./addresses.js";
import { openCashDelegateAbi } from "./delegateAbi.js";

// Not deployed yet — set once contracts/src/OpenCashDelegate.sol is deployed
// to Robinhood Chain mainnet (chain 4663).
export const delegateAddress: Address | null = null;

export const approveSelector = toFunctionSelector("approve(address,uint256)");
export const multicallSelector = toFunctionSelector("multicall(bytes[])");

export const defaultSessionDurationSeconds = 30 * 24 * 60 * 60;

export function agentSessionScope(): { targets: Address[]; selectors: Hex[] } {
  return {
    targets: [hoodMainnet.usdg, hoodMainnet.swapRouter02],
    selectors: [approveSelector, multicallSelector],
  };
}

export function authorizeSessionRequest(agentKey: Address, expirySeconds: number) {
  const scope = agentSessionScope();
  return {
    abi: openCashDelegateAbi,
    functionName: "authorizeSession",
    args: [agentKey, BigInt(expirySeconds), scope.targets, scope.selectors],
  } as const;
}

export function revokeSessionRequest(agentKey: Address) {
  return {
    abi: openCashDelegateAbi,
    functionName: "revokeSession",
    args: [agentKey],
  } as const;
}

export function sessionRequest(agentKey: Address) {
  return {
    abi: openCashDelegateAbi,
    functionName: "sessions",
    args: [agentKey],
  } as const;
}

// EIP-7702 designator: eth_getCode on a delegated EOA returns 0xef0100 ++ the
// 20-byte delegate address, never real bytecode.
export function delegatesTo(code: Hex | undefined, target: Address): boolean {
  if (!code) return false;
  return code.toLowerCase() === `0xef0100${target.slice(2).toLowerCase()}`;
}
