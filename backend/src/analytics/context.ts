import { createPublicClient, http, type PublicClient } from "viem";
import { monad, monadTestnetChain, perpl } from "shared";

export type Net = "mainnet" | "testnet";

export type Context = {
  net: Net;
  client: PublicClient;
  deployment: perpl.PerplDeployment;
  api: ReturnType<typeof perpl.createPerplApi>;
};

const contexts = new Map<Net, Context>();

export function parseNet(value: unknown): Net {
  return value === "testnet" ? "testnet" : "mainnet";
}

export function contextFor(net: Net): Context {
  const existing = contexts.get(net);
  if (existing) return existing;
  const deployment = net === "mainnet" ? perpl.perplMainnet : perpl.perplTestnet;
  const context: Context = {
    net,
    deployment,
    client: createPublicClient({
      chain: net === "mainnet" ? monad : monadTestnetChain,
      transport: http(),
      batch: { multicall: { wait: 20 } },
    }) as PublicClient,
    api: perpl.createPerplApi(deployment.apiUrl),
  };
  contexts.set(net, context);
  return context;
}
