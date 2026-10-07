import { createPublicClient, http } from "viem";
import { monad, monadTestnetChain, perpl } from "shared";

export const network = process.env.LEADERBOARD_NETWORK === "mainnet" ? "mainnet" : "testnet";
export const deployment = network === "mainnet" ? perpl.perplMainnet : perpl.perplTestnet;
export const client = createPublicClient({
  chain: network === "mainnet" ? monad : monadTestnetChain,
  transport: http(),
  batch: { multicall: { wait: 20 } },
});
export const api = perpl.createPerplApi(deployment.apiUrl);

export async function accountIdFor(address: `0x${string}`): Promise<number | null> {
  const account = await perpl.fetchAccount(client, deployment.exchange, address);
  return account ? Number(account.accountId) : null;
}
