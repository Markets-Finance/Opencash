import { ExchangeClient, HttpTransport, InfoClient } from "@nktkas/hyperliquid";

export type HlNetwork = "mainnet" | "testnet";
type ExchangeConfig = ConstructorParameters<typeof ExchangeClient>[0];
export type HlWallet = Extract<ExchangeConfig, { wallet: unknown }>["wallet"];

function transportFor(network: HlNetwork): HttpTransport {
  return new HttpTransport({ isTestnet: network === "testnet" });
}

export function createHlInfo(network: HlNetwork = "mainnet"): InfoClient {
  return new InfoClient({ transport: transportFor(network) });
}

export function createHlExchange(network: HlNetwork, wallet: HlWallet): ExchangeClient {
  return new ExchangeClient({ transport: transportFor(network), wallet });
}
