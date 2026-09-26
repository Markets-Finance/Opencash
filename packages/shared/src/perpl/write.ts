import { erc20Abi, type Address } from "viem";
import { exchangeAbi } from "./abi.js";

export function approveCollateralRequest(
  collateral: Address,
  exchange: Address,
  amountCNS: bigint,
) {
  return {
    address: collateral,
    abi: erc20Abi,
    functionName: "approve",
    args: [exchange, amountCNS],
  } as const;
}

export function createAccountRequest(exchange: Address, amountCNS: bigint) {
  return {
    address: exchange,
    abi: exchangeAbi,
    functionName: "createAccount",
    args: [amountCNS],
  } as const;
}

export function depositCollateralRequest(exchange: Address, amountCNS: bigint) {
  return {
    address: exchange,
    abi: exchangeAbi,
    functionName: "depositCollateral",
    args: [amountCNS],
  } as const;
}

export function withdrawCollateralRequest(exchange: Address, amountCNS: bigint) {
  return {
    address: exchange,
    abi: exchangeAbi,
    functionName: "withdrawCollateral",
    args: [amountCNS],
  } as const;
}

export function allowanceRequest(
  collateral: Address,
  owner: Address,
  exchange: Address,
) {
  return {
    address: collateral,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, exchange],
  } as const;
}

export function balanceOfRequest(collateral: Address, owner: Address) {
  return {
    address: collateral,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  } as const;
}
