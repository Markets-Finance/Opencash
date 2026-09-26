import { erc20Abi, type Address } from "viem";
import { swapRouter02Abi } from "./abi.js";
import { hoodMainnet } from "./addresses.js";

export function allowanceRequest(token: Address, owner: Address, spender: Address) {
  return {
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  } as const;
}

export function approveRequest(token: Address, spender: Address, amount: bigint) {
  return {
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
  } as const;
}

export function balanceOfRequest(token: Address, owner: Address) {
  return {
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  } as const;
}

export const defaultSlippageBps = 100;

export function exactInputSingleRequest(
  tokenIn: Address,
  tokenOut: Address,
  fee: number,
  recipient: Address,
  amountIn: bigint,
  quotedAmountOut: bigint,
  slippageBps: number = defaultSlippageBps,
) {
  const amountOutMinimum =
    quotedAmountOut - (quotedAmountOut * BigInt(slippageBps)) / 10000n;
  return {
    address: hoodMainnet.swapRouter02,
    abi: swapRouter02Abi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn,
        tokenOut,
        fee,
        recipient,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  } as const;
}
