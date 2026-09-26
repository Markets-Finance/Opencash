import { monadMainnet, monadTestnet } from "../chains.js";

export type PerplDeployment = {
  chainId: number;
  instanceId: number;
  exchange: `0x${string}`;
  collateral: `0x${string}`;
  collateralDecimals: number;
};

export const perplMainnet: PerplDeployment = {
  chainId: monadMainnet.id,
  instanceId: 1,
  exchange: "0x34B6552d57a35a1D042CcAe1951BD1C370112a6F",
  collateral: "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a",
  collateralDecimals: 6,
};

export const perplTestnet: PerplDeployment = {
  chainId: monadTestnet.id,
  instanceId: 12,
  exchange: "0x1964C32f0bE608E7D29302AFF5E61268E72080cc",
  collateral: "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC",
  collateralDecimals: 6,
};

export function deploymentForChain(chainId: number): PerplDeployment {
  if (chainId === perplMainnet.chainId) return perplMainnet;
  if (chainId === perplTestnet.chainId) return perplTestnet;
  throw new Error(`No Perpl deployment for chain ${chainId}`);
}
