import { hood, type TradingAccount } from "shared";
import { createPublicClient, createWalletClient, http } from "viem";

export function publicClient() {
  return createPublicClient({ chain: hood, transport: http() });
}

export function walletClientFor(tradingAccount: TradingAccount) {
  return createWalletClient({
    account: tradingAccount.account,
    chain: hood,
    transport: http(),
  });
}
