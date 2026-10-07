import { defineChain } from "viem";
import { monadMainnet, monadTestnet } from "./chains.js";

const multicall3 = { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } as const;

export const monad = defineChain({
  id: monadMainnet.id,
  name: monadMainnet.name,
  nativeCurrency: monadMainnet.nativeCurrency,
  rpcUrls: { default: { http: [monadMainnet.rpcUrl] } },
  contracts: { multicall3 },
  blockExplorers: {
    default: { name: "Monad Explorer", url: monadMainnet.explorer },
  },
});

export const monadTestnetChain = defineChain({
  id: monadTestnet.id,
  name: monadTestnet.name,
  nativeCurrency: monadTestnet.nativeCurrency,
  rpcUrls: { default: { http: [monadTestnet.rpcUrl] } },
  contracts: { multicall3 },
  blockExplorers: {
    default: { name: "Monad Testnet Explorer", url: monadTestnet.explorer },
  },
});
