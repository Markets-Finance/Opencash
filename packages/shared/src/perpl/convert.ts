import { parseAbi, type Address, type PublicClient } from "viem";

export type ConvertVenue = {
  pool: Address;
  usdc: Address;
  usdcIndex: number;
  collateralIndex: number;
};

export const curveAbi = parseAbi([
  "function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy) returns (uint256)",
  "function get_dy(int128 i, int128 j, uint256 dx) view returns (uint256)",
]);

export const mainnetConvert: ConvertVenue = {
  pool: "0x942644106b073e30d72c2c5d7529d5c296ea91ab",
  usdc: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
  usdcIndex: 1,
  collateralIndex: 0,
};

export const defaultConvertSlippageBps = 10;

export function quoteConvertRequest(venue: ConvertVenue, usdcAmount: bigint) {
  return {
    address: venue.pool,
    abi: curveAbi,
    functionName: "get_dy",
    args: [BigInt(venue.usdcIndex), BigInt(venue.collateralIndex), usdcAmount],
  } as const;
}

export function swapRequest(venue: ConvertVenue, usdcAmount: bigint, minOut: bigint) {
  return {
    address: venue.pool,
    abi: curveAbi,
    functionName: "exchange",
    args: [BigInt(venue.usdcIndex), BigInt(venue.collateralIndex), usdcAmount, minOut],
  } as const;
}

export function minimumOut(quote: bigint, slippageBps: number): bigint {
  return (quote * BigInt(10_000 - Math.round(slippageBps))) / 10_000n;
}

export async function quoteUsdcToCollateral(client: PublicClient, venue: ConvertVenue, usdcAmount: bigint): Promise<bigint> {
  return (await client.readContract(quoteConvertRequest(venue, usdcAmount))) as bigint;
}
