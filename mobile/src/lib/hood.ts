import {
  allowanceRequest,
  approveRequest,
  balanceOfRequest,
  binById,
  binEntrySwaps,
  bins,
  fetchBinPosition,
  fetchDisplayedBalance,
  fetchOfficialPrices,
  findDeepestPool,
  fromScaled,
  hoodMainnet,
  loadStockTokens,
  quoteTokenToUsdg,
  quoteUsdgToToken,
  sizeBin,
  swapRouter02Abi,
  tokensBySymbol,
  toScaled,
  type Bin,
  type BinSizingIssue,
  type HoodQuote,
  type HoodSellQuote,
  type SizedBin,
  type BinPosition,
  type StockTokenEntry,
  type TradingAccount,
} from "shared";
import { encodeFunctionData, type Address, type Hash, type PublicClient } from "viem";
import { publicClient, walletClientFor } from "./mera";

const client = publicClient as unknown as PublicClient;

export type HoodData = {
  tokens: Map<string, StockTokenEntry>;
  price: Map<string, number>;
};

export async function loadTokens(): Promise<HoodData> {
  const list = await loadStockTokens();
  const tokens = tokensBySymbol(list);

  const symbols = new Set(bins.flatMap((bin) => bin.legs.map((leg) => leg.symbol)));
  const price = new Map<string, number>();

  await Promise.all(
    [...symbols].map(async (symbol) => {
      const token = tokens.get(symbol);
      if (!token) return;
      const quote = await quoteUsdgToToken(client, token.tokenAddress, 1, token.tokenDecimals);
      if (quote) price.set(symbol, quote.price);
    }),
  );

  return { tokens, price };
}

export async function loadUsdgBalance(owner: Address): Promise<number> {
  const raw = await client.readContract(balanceOfRequest(hoodMainnet.usdg, owner));
  return fromScaled(raw, hoodMainnet.usdgDecimals);
}

export type TradeAsset = {
  token: StockTokenEntry;
  price: number | null;
  halted: boolean;
};

export async function loadPositions(
  owner: Address,
  tokens: Map<string, StockTokenEntry>,
): Promise<BinPosition[]> {
  const held = await Promise.all(
    bins.map((bin) => fetchBinPosition(client, bin, tokens, owner)),
  );
  return held.filter((position): position is BinPosition => position !== null);
}

// Tier 2 (Robinhood Chain) has ~195 Stock Tokens. Pricing every one on-chain
// (pool discovery + a QuoterV2 call each) is both slow and, per the pool
// liquidity survey, mostly wasted — Robinhood's own read-only /rhj/prices
// endpoint gives the same reference price over plain HTTPS, no RPC. This is
// a reference price for browsing only; the real, tradable price still comes
// from quoteUsdgToToken against the live pool at trade time.
export async function loadTradeAssets(
  tokens: Map<string, StockTokenEntry>,
): Promise<TradeAsset[]> {
  const symbols = [...tokens.keys()];
  const prices = await fetchOfficialPrices(symbols);

  return symbols
    .map((symbol) => {
      const token = tokens.get(symbol);
      if (!token) return null;
      const quote = prices.get(symbol);
      return {
        token,
        price: quote ? (quote.tokenBid + quote.tokenAsk) / 2 : null,
        halted: quote?.isTradingHalt ?? false,
      };
    })
    .filter((asset): asset is TradeAsset => asset !== null)
    .sort((a, b) => a.token.symbol.localeCompare(b.token.symbol));
}

// Whether a token actually has a live Uniswap pool to trade against —
// distinct from the official reference price, which several Stock Tokens
// have despite an empty or nonexistent onchain pool.
export function checkTradable(token: StockTokenEntry) {
  return findDeepestPool(client, token.tokenAddress);
}

export function quoteTrade(
  token: StockTokenEntry,
  usdgIn: number,
): Promise<HoodQuote | null> {
  return quoteUsdgToToken(client, token.tokenAddress, usdgIn, token.tokenDecimals);
}

export type TokenHolding = { raw: bigint; shares: number };

export async function loadTokenHolding(
  owner: Address,
  token: StockTokenEntry,
): Promise<TokenHolding> {
  const raw = await client.readContract(balanceOfRequest(token.tokenAddress, owner));
  if (raw === 0n) return { raw, shares: 0 };
  const shares = await fetchDisplayedBalance(client, token.tokenAddress, raw, token.tokenDecimals);
  return { raw, shares };
}

// Quotes off the displayed share count (an estimate) — fine for a preview.
// Execution always uses the exact raw balance/fraction, never this number,
// so it isn't exposed to the multiplier rounding a display-unit round-trip
// would introduce.
export function quoteSell(
  token: StockTokenEntry,
  shares: number,
): Promise<HoodSellQuote | null> {
  return quoteTokenToUsdg(client, token.tokenAddress, shares, token.tokenDecimals);
}

export type EntryStep = "approve" | "swap";
export type EntryProgress = (step: EntryStep, hash: Hash) => void;

export async function buyToken(
  tradingAccount: TradingAccount,
  token: StockTokenEntry,
  usdgIn: number,
  quote: HoodQuote,
  onStep: EntryProgress,
): Promise<void> {
  const wallet = walletClientFor(tradingAccount);
  const owner = tradingAccount.address;
  const amountIn = toScaled(usdgIn, hoodMainnet.usdgDecimals);

  const allowance = await client.readContract(
    allowanceRequest(hoodMainnet.usdg, owner, hoodMainnet.swapRouter02),
  );

  if (allowance < amountIn) {
    const approveHash = await wallet.writeContract({
      ...approveRequest(hoodMainnet.usdg, hoodMainnet.swapRouter02, amountIn),
      chain: wallet.chain,
      account: tradingAccount.account,
    });
    onStep("approve", approveHash);
    await client.waitForTransactionReceipt({ hash: approveHash });
  }

  const swapHash = await wallet.writeContract({
    address: hoodMainnet.swapRouter02,
    abi: swapRouter02Abi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: hoodMainnet.usdg,
        tokenOut: token.tokenAddress,
        fee: quote.fee,
        recipient: owner,
        amountIn,
        amountOutMinimum: quote.amountOut - (quote.amountOut * 100n) / 10000n,
        sqrtPriceLimitX96: 0n,
      },
    ],
    chain: wallet.chain,
    account: tradingAccount.account,
  });
  onStep("swap", swapHash);
  await client.waitForTransactionReceipt({ hash: swapHash });
}

export async function sellToken(
  tradingAccount: TradingAccount,
  token: StockTokenEntry,
  amountInRaw: bigint,
  quote: HoodSellQuote,
  onStep: EntryProgress,
): Promise<void> {
  const wallet = walletClientFor(tradingAccount);
  const owner = tradingAccount.address;

  const allowance = await client.readContract(
    allowanceRequest(token.tokenAddress, owner, hoodMainnet.swapRouter02),
  );

  if (allowance < amountInRaw) {
    const approveHash = await wallet.writeContract({
      ...approveRequest(token.tokenAddress, hoodMainnet.swapRouter02, amountInRaw),
      chain: wallet.chain,
      account: tradingAccount.account,
    });
    onStep("approve", approveHash);
    await client.waitForTransactionReceipt({ hash: approveHash });
  }

  const swapHash = await wallet.writeContract({
    address: hoodMainnet.swapRouter02,
    abi: swapRouter02Abi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: token.tokenAddress,
        tokenOut: hoodMainnet.usdg,
        fee: quote.fee,
        recipient: owner,
        amountIn: amountInRaw,
        amountOutMinimum: quote.amountOut - (quote.amountOut * 100n) / 10000n,
        sqrtPriceLimitX96: 0n,
      },
    ],
    chain: wallet.chain,
    account: tradingAccount.account,
  });
  onStep("swap", swapHash);
  await client.waitForTransactionReceipt({ hash: swapHash });
}

export function sizeBinFor(
  bin: Bin,
  usdgAmount: number,
  tokens: Map<string, StockTokenEntry>,
): Promise<{ sized: SizedBin; issues: BinSizingIssue[] }> {
  return sizeBin(client, bin, usdgAmount, tokens);
}

export async function openBin(
  tradingAccount: TradingAccount,
  sized: SizedBin,
  onStep: EntryProgress,
): Promise<void> {
  const wallet = walletClientFor(tradingAccount);
  const owner = tradingAccount.address;
  const total = toScaled(sized.usdgIn, hoodMainnet.usdgDecimals);

  const allowance = await client.readContract(
    allowanceRequest(hoodMainnet.usdg, owner, hoodMainnet.swapRouter02),
  );

  if (allowance < total) {
    const approveHash = await wallet.writeContract({
      ...approveRequest(hoodMainnet.usdg, hoodMainnet.swapRouter02, total),
      chain: wallet.chain,
      account: tradingAccount.account,
    });
    onStep("approve", approveHash);
    await client.waitForTransactionReceipt({ hash: approveHash });
  }

  const swaps = binEntrySwaps(sized, owner);
  const calls = swaps.map((swap) => encodeFunctionData(swap));

  const swapHash = await wallet.writeContract({
    address: hoodMainnet.swapRouter02,
    abi: swapRouter02Abi,
    functionName: "multicall",
    args: [calls],
    chain: wallet.chain,
    account: tradingAccount.account,
  });
  onStep("swap", swapHash);
  await client.waitForTransactionReceipt({ hash: swapHash });
}

// Manual-approval execution: SERV proposed this allocation, but it runs
// through the same signing path as any bin bought by hand — your own
// passkey key, not a delegated session key. No contract deployment needed.
export async function sizeProposal(
  binId: string,
  usdgAmount: number,
  tokens: Map<string, StockTokenEntry>,
): Promise<{ sized: SizedBin; issues: BinSizingIssue[] } | null> {
  const bin = binById(binId);
  if (!bin) return null;
  return sizeBin(client, bin, usdgAmount, tokens);
}
