import { defineChain } from "viem";
import { monadMainnet, monadTestnet } from "./chains.js";

export const monad = defineChain({
  id: monadMainnet.id,
  name: monadMainnet.name,
  nativeCurrency: monadMainnet.nativeCurrency,
  rpcUrls: { default: { http: [monadMainnet.rpcUrl] } },
  blockExplorers: {
    default: { name: "Monad Explorer", url: monadMainnet.explorer },
  },
});

export const monadTestnetChain = defineChain({
  id: monadTestnet.id,
  name: monadTestnet.name,
  nativeCurrency: monadTestnet.nativeCurrency,
  rpcUrls: { default: { http: [monadTestnet.rpcUrl] } },
  blockExplorers: {
    default: { name: "Monad Testnet Explorer", url: monadTestnet.explorer },
  },
});
