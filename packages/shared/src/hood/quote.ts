import { zeroAddress, type Address, type PublicClient } from "viem";
import { hoodMainnet, uniswapV3FeeTiers } from "./addresses.js";
import { quoterV2Abi, uniswapV3FactoryAbi, uniswapV3PoolAbi } from "./abi.js";
import { fromScaled, toScaled } from "./scale.js";

export type HoodPool = {
  fee: number;
  pool: Address;
};

export type HoodQuote = {
  token: Address;
  fee: number;
  pool: Address;
  usdgIn: number;
  amountOut: bigint;
  tokensOut: number;
  price: number;
};

export async function findDeepestPool(
  client: PublicClient,
  token: Address,
): Promise<HoodPool | null> {
  const candidates = await Promise.all(
    uniswapV3FeeTiers.map(async (fee) => {
      const pool = await client.readContract({
        address: hoodMainnet.uniswapV3Factory,
        abi: uniswapV3FactoryAbi,
        functionName: "getPool",
        args: [hoodMainnet.usdg, token, fee],
      });
      if (pool === zeroAddress) return null;
      const liquidity = await client.readContract({
        address: pool,
        abi: uniswapV3PoolAbi,
        functionName: "liquidity",
      });
      return { fee, pool, liquidity };
    }),
  );

  const pools = candidates.filter((c): c is NonNullable<typeof c> => c !== null);
  if (pools.length === 0) return null;

  pools.sort((a, b) => (b.liquidity > a.liquidity ? 1 : a.liquidity > b.liquidity ? -1 : 0));
  return { fee: pools[0].fee, pool: pools[0].pool };
}

export async function quoteUsdgToToken(
  client: PublicClient,
  token: Address,
  usdgIn: number,
  tokenDecimals: number,
  pool?: HoodPool,
): Promise<HoodQuote | null> {
  const found = pool ?? (await findDeepestPool(client, token));
  if (!found) return null;

  const amountIn = toScaled(usdgIn, hoodMainnet.usdgDecimals);
  const { result } = await client.simulateContract({
    address: hoodMainnet.quoterV2,
    abi: quoterV2Abi,
    functionName: "quoteExactInputSingle",
    args: [
      {
        tokenIn: hoodMainnet.usdg,
        tokenOut: token,
        amountIn,
        fee: found.fee,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  const [amountOut] = result;
  const tokensOut = fromScaled(amountOut, tokenDecimals);

  return {
    token,
    fee: found.fee,
    pool: found.pool,
    usdgIn,
    amountOut,
    tokensOut,
    price: tokensOut > 0 ? usdgIn / tokensOut : 0,
  };
}
