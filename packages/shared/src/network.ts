import { perplMainnet, perplTestnet, type PerplDeployment } from "./perpl/addresses.js";
import { monad, monadTestnetChain } from "./viem-chain.js";

export type MonadNetwork = "mainnet" | "testnet";

export function networkFrom(value: string | undefined): MonadNetwork {
  return value === "testnet" ? "testnet" : "mainnet";
}

export function chainFor(network: MonadNetwork) {
  return network === "mainnet" ? monad : monadTestnetChain;
}

export function perplFor(network: MonadNetwork): PerplDeployment {
  return network === "mainnet" ? perplMainnet : perplTestnet;
}

export function networkLabel(network: MonadNetwork): string {
  return network === "mainnet" ? "Monad" : "Monad Testnet";
}
