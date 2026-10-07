import { monadTestnetChain, type TradingAccount } from "shared";
import { createPublicClient, createWalletClient, http } from "viem";

export const publicClient = createPublicClient({
  chain: monadTestnetChain,
  transport: http(),
  batch: { multicall: { wait: 20 } },
});

export function walletClientFor(tradingAccount: TradingAccount) {
  return createWalletClient({
    account: tradingAccount.account,
    chain: monadTestnetChain,
    transport: http(),
  });
}
