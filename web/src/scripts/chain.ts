import type { TradingAccount } from "shared";
import { chain } from "../data/network";
import { createPublicClient, createWalletClient, http } from "viem";

export const publicClient = createPublicClient({
  chain,
  transport: http(),
  batch: { multicall: { wait: 20 } },
});

export function walletClientFor(tradingAccount: TradingAccount) {
  return createWalletClient({
    account: tradingAccount.account,
    chain,
    transport: http(),
  });
}
