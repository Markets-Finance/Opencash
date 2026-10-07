import {
  bins,
  binEntryOrders,
  fetchBinPosition,
  execOrdersRequest,
  perpl,
  sizeBin,
  type Bin,
  type BinPosition,
  type BinSizingIssue,
  type SizedBin,
  type TradingAccount,
} from "shared";
import type { Address, Hash, PublicClient } from "viem";
import { publicClient, walletClientFor } from "./mera";

export const deployment = perpl.perplTestnet;

const client = publicClient as unknown as PublicClient;

export type MarketData = {
  markets: Map<string, perpl.PerpMarket>;
  maxLeverage: Map<string, number>;
};

export async function loadMarkets(): Promise<MarketData> {
  const list = await perpl.fetchMarkets(client, deployment.exchange);
  const maxLeverage = new Map<string, number>();

  await Promise.all(
    list.map(async (market) => {
      const terms = await perpl.fetchMarginTerms(client, deployment.exchange, market, 1);
      maxLeverage.set(market.symbol, terms.maxLeverage);
    }),
  );

  return { markets: perpl.marketsBySymbol(list), maxLeverage };
}

export function loadAccount(owner: Address): Promise<perpl.PerplAccount | null> {
  return perpl.fetchAccount(client, deployment.exchange, owner);
}

export async function loadCollateralBalance(owner: Address): Promise<number> {
  const raw = await client.readContract(perpl.balanceOfRequest(deployment.collateral, owner));
  return perpl.fromScaled(raw, deployment.collateralDecimals);
}

export function sizeBinFor(
  bin: Bin,
  margin: number,
  data: MarketData,
): { sized: SizedBin; issues: BinSizingIssue[] } {
  return sizeBin(bin, margin, data.markets, data.maxLeverage);
}

export const binSymbols = [...new Set(bins.flatMap((bin) => bin.legs.map((leg) => leg.symbol)))];

export type EntryStep = "approve" | "fund" | "orders";

export type EntryProgress = (step: EntryStep, hash: Hash) => void;

export async function openBin(
  tradingAccount: TradingAccount,
  sized: SizedBin,
  data: MarketData,
  onStep: EntryProgress,
): Promise<void> {
  const wallet = walletClientFor(tradingAccount);
  const owner = tradingAccount.address;
  const descs = binEntryOrders(sized, data.markets, { postOnly: true });
  const total = descs.reduce((sum, desc) => sum + desc.amountCNS, 0n);
  const signer = { chain: wallet.chain, account: tradingAccount.account };

  const allowance = await client.readContract(
    perpl.allowanceRequest(deployment.collateral, owner, deployment.exchange),
  );

  if (allowance < total) {
    const hash = await wallet.writeContract({
      ...perpl.approveCollateralRequest(deployment.collateral, deployment.exchange, total),
      ...signer,
    });
    onStep("approve", hash);
    await client.waitForTransactionReceipt({ hash });
  }

  const existing = await perpl.fetchAccount(client, deployment.exchange, owner);
  const fund = existing
    ? perpl.depositCollateralRequest(deployment.exchange, total)
    : perpl.createAccountRequest(deployment.exchange, total);

  const fundHash = await wallet.writeContract({ ...fund, ...signer });
  onStep("fund", fundHash);
  await client.waitForTransactionReceipt({ hash: fundHash });

  const ordersHash = await wallet.writeContract({
    ...execOrdersRequest(deployment.exchange, descs, true),
    ...signer,
  });
  onStep("orders", ordersHash);
  await client.waitForTransactionReceipt({ hash: ordersHash });
}

export async function loadPositions(
  owner: Address,
  data: MarketData,
): Promise<BinPosition[]> {
  const account = await loadAccount(owner);
  if (account === null) return [];
  const held = await Promise.all(
    bins.map((bin) =>
      fetchBinPosition(client, deployment.exchange, bin, data.markets, account.accountId),
    ),
  );
  return held.filter((position): position is BinPosition => position !== null);
}

export type PortfolioSummary = {
  total: number;
  unrealizedPnl: number;
  symbols: string[];
};

export async function loadSummary(owner: Address, data: MarketData): Promise<PortfolioSummary> {
  const [wallet, account, positions] = await Promise.all([
    loadCollateralBalance(owner),
    loadAccount(owner),
    loadPositions(owner, data),
  ]);
  const inPositions = positions.reduce((sum, p) => sum + p.deposit + p.pnl, 0);
  return {
    total: wallet + (account?.balance ?? 0) + inPositions,
    unrealizedPnl: positions.reduce((sum, p) => sum + p.pnl, 0),
    symbols: [...new Set(positions.flatMap((p) => p.legs.map((leg) => leg.symbol)))],
  };
}
