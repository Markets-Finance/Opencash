import { monad, type TradingAccount } from "shared";
import { createPublicClient, createWalletClient, http } from "viem";

export function publicClient() {
  return createPublicClient({ chain: monad, transport: http() });
}

export function walletClientFor(tradingAccount: TradingAccount) {
  return createWalletClient({
    account: tradingAccount.account,
    chain: monad,
    transport: http(),
  });
}
