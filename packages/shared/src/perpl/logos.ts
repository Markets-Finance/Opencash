const overrides: Record<string, string> = {
  MON: "https://coin-images.coingecko.com/coins/images/38927/large/mon.png",
};

export function normalizeSymbol(symbol: string): string {
  return symbol.replace(/_v\d+$/i, "");
}

export function marketLogoUrl(symbol: string): string {
  const base = normalizeSymbol(symbol);
  return overrides[base] ?? `https://assets.coincap.io/assets/icons/${base.toLowerCase()}@2x.png`;
}
