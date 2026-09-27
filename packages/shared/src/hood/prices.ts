// Robinhood's own read-only registry API (api.robinhood.com/rhj/) — public,
// no auth, 60 req/s. tokenBid/tokenAsk are already multiplier-adjusted, so
// unlike /assets this needs no separate corporate-action math.
const baseUrl = "https://api.robinhood.com/rhj";

export type OfficialQuote = {
  symbol: string;
  bid: number;
  ask: number;
  tokenBid: number;
  tokenAsk: number;
  isTradingHalt: boolean;
};

type PricesResponse = {
  quotes?: {
    tokenSymbol: string;
    bid: string;
    ask: string;
    tokenBid: string;
    tokenAsk: string;
    isTradingHalt: boolean;
  }[];
};

export async function fetchOfficialPrice(symbol: string): Promise<OfficialQuote | null> {
  try {
    const response = await fetch(`${baseUrl}/prices/${symbol}`);
    if (!response.ok) return null;
    const data = (await response.json()) as PricesResponse;
    const quote = data.quotes?.[0];
    if (!quote) return null;
    return {
      symbol: quote.tokenSymbol,
      bid: Number(quote.bid),
      ask: Number(quote.ask),
      tokenBid: Number(quote.tokenBid),
      tokenAsk: Number(quote.tokenAsk),
      isTradingHalt: quote.isTradingHalt,
    };
  } catch {
    return null;
  }
}

// No batch endpoint exists — chunk to stay well under the 60 req/s limit.
export async function fetchOfficialPrices(
  symbols: readonly string[],
  chunkSize = 20,
): Promise<Map<string, OfficialQuote>> {
  const result = new Map<string, OfficialQuote>();
  for (let i = 0; i < symbols.length; i += chunkSize) {
    const chunk = symbols.slice(i, i + chunkSize);
    const quotes = await Promise.all(chunk.map(fetchOfficialPrice));
    quotes.forEach((quote) => {
      if (quote) result.set(quote.symbol, quote);
    });
  }
  return result;
}
