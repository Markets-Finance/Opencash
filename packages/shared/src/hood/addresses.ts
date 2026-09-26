export type HoodDeployment = {
  chainId: number;
  rpcUrl: string;
  explorer: string;
  usdg: `0x${string}`;
  usdgDecimals: number;
  weth: `0x${string}`;
  uniswapV3Factory: `0x${string}`;
  quoterV2: `0x${string}`;
  swapRouter02: `0x${string}`;
};

// Verified against the live chain: Factory.feeAmountTickSpacing(3000) === 60,
// SwapRouter02.factory() and .WETH9() both resolve back to these addresses,
// and QuoterV2.quoteExactInputSingle returns a real quote through them.
export const hoodMainnet: HoodDeployment = {
  chainId: 4663,
  rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
  explorer: "https://robinhoodchain.blockscout.com",
  usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
  usdgDecimals: 6,
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
  uniswapV3Factory: "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA",
  quoterV2: "0x33E885ED0EC9BF04ECfB19341582AAdCB4C8A9E7",
  swapRouter02: "0xCaf681a66D020601342297493863E78c959E5cB2",
};

// Robinhood Chain testnet (46630) has no USDG, stock tokens, or Uniswap
// deployment yet — it only exists for wallet/passkey mechanics.
export const hoodTestnetChainId = 46630;
export const hoodTestnetRpcUrl = "https://rpc.testnet.chain.robinhood.com";

// v3 fee tiers to probe when looking for a token's deepest USDG pool.
export const uniswapV3FeeTiers = [500, 3000, 10000] as const;
