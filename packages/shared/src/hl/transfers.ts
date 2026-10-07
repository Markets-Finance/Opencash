import type { ExchangeClient } from "@nktkas/hyperliquid";

export function moveUsd(exchange: ExchangeClient, amount: number, toPerp: boolean) {
  return exchange.usdClassTransfer({ amount: String(amount), toPerp });
}

export function withdrawUsd(
  exchange: ExchangeClient,
  amount: number,
  destination: `0x${string}`,
  verifiedDestinations: readonly `0x${string}`[],
) {
  const allowed = verifiedDestinations.some((a) => a.toLowerCase() === destination.toLowerCase());
  if (!allowed) throw new Error("Destination is not a verified address");
  return exchange.withdraw3({ amount: String(amount), destination });
}

export function updateIsolatedMargin(
  exchange: ExchangeClient,
  assetId: number,
  isLong: boolean,
  amountUsd: number,
) {
  return exchange.updateIsolatedMargin({
    asset: assetId,
    isBuy: isLong,
    ntli: Math.round(amountUsd * 1e6),
  });
}
