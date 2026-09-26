import {
  allowanceRequest,
  approveRequest,
  balanceOfRequest,
  binEntrySwaps,
  bins,
  fetchBinPosition,
  fromScaled,
  hoodMainnet,
  loadStockTokens,
  quoteUsdgToToken,
  sizeBin,
  swapRouter02Abi,
  tokensBySymbol,
  toScaled,
  type Bin,
  type BinSizingIssue,
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

export async function loadTradeAssets(
  tokens: Map<string, StockTokenEntry>,
): Promise<TradeAsset[]> {
  return Promise.all(
    [...tokens.values()].map(async (token) => {
      const quote = await quoteUsdgToToken(
        client,
        token.tokenAddress,
        1,
        token.tokenDecimals,
      );
      return { token, price: quote ? quote.price : null };
    }),
  );
}

export function sizeBinFor(
  bin: Bin,
  usdgAmount: number,
  tokens: Map<string, StockTokenEntry>,
): Promise<{ sized: SizedBin; issues: BinSizingIssue[] }> {
  return sizeBin(client, bin, usdgAmount, tokens);
}

export type EntryStep = "approve" | "swap";
export type EntryProgress = (step: EntryStep, hash: Hash) => void;

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
