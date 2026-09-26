import { defineChain } from "viem";
import { hoodMainnet, hoodTestnetChainId, hoodTestnetRpcUrl } from "./addresses.js";

export const hood = defineChain({
  id: hoodMainnet.chainId,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [hoodMainnet.rpcUrl] } },
  blockExplorers: {
    default: { name: "Blockscout", url: hoodMainnet.explorer },
  },
});

export const hoodTestnetChain = defineChain({
  id: hoodTestnetChainId,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [hoodTestnetRpcUrl] } },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://explorer.testnet.chain.robinhood.com",
    },
  },
  testnet: true,
});
