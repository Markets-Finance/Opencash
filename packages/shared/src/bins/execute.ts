import type { Address } from "viem";
import { exactInputSingleRequest } from "../hood/swap.js";
import { hoodMainnet } from "../hood/addresses.js";
import { toScaled } from "../hood/scale.js";
import type { SizedBin } from "./types.js";

export type BinSwapOptions = {
  slippageBps?: number;
};

export function binEntrySwaps(
  sized: SizedBin,
  recipient: Address,
  options: BinSwapOptions = {},
) {
  return sized.legs.map((leg) => {
    const amountIn = toScaled(leg.usdgIn, hoodMainnet.usdgDecimals);
    return exactInputSingleRequest(
      hoodMainnet.usdg,
      leg.token.tokenAddress,
      leg.quote.fee,
      recipient,
      amountIn,
      leg.quote.amountOut,
      options.slippageBps,
    );
  });
}
