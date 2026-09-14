export type MonadChain = {
  id: number;
  name: string;
  rpcUrl: string;
  explorer: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
};

export const monadMainnet: MonadChain = {
  id: 143,
  name: "Monad",
  rpcUrl: "https://rpc.monad.xyz",
  explorer: "https://explorer.monad.xyz",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
};

export const monadTestnet: MonadChain = {
  id: 10143,
  name: "Monad Testnet",
  rpcUrl: "https://testnet-rpc.monad.xyz",
  explorer: "https://testnet.monadexplorer.com",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
};
