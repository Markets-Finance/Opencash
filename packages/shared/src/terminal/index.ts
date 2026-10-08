import { erc20Abi, formatEther, isAddress, parseEther, zeroAddress } from "viem";
import type { Account, Address, Chain, Hash, PublicClient, Transport, WalletClient } from "viem";
import { binEntryOrders, binExitOrders, execOrdersRequest } from "../bins/execute.js";
import { bins } from "../bins/catalog.js";
import { fetchBinPosition } from "../bins/position.js";
import { sizeBin } from "../bins/sizing.js";
import type { Bin, BinSizingIssue, SizedBin } from "../bins/types.js";
import type { TradingAccount } from "../mera/index.js";
import { fetchAccount, fetchPosition } from "../perpl/account.js";
import type { PerplAccount, PerpPosition } from "../perpl/account.js";
import { fetchMarginTerms, fetchMarkets, marketsBySymbol } from "../perpl/markets.js";
import type { PerpMarket } from "../perpl/markets.js";
import { fromScaled, toCNS, toScaled } from "../perpl/scale.js";
import type { PerplDeployment } from "../perpl/addresses.js";
import { withdrawCollateralRequest } from "../perpl/write.js";
import {
  allowanceRequest,
  approveCollateralRequest,
  balanceOfRequest,
  createAccountRequest,
  depositCollateralRequest,
} from "../perpl/write.js";
import type { BinPosition } from "../bins/position.js";

export type MarketData = {
  markets: Map<string, PerpMarket>;
  maxLeverage: Map<string, number>;
};

export type OpenPosition = { market: PerpMarket; position: PerpPosition };

export type EntryStep = "approve" | "fund" | "orders";

export type EntryProgress = (step: EntryStep, hash: Hash) => void;

export type PortfolioSummary = {
  total: number;
  unrealizedPnl: number;
  symbols: string[];
};

export type TerminalConfig = {
  publicClient: unknown;
  walletClientFor: (account: TradingAccount) => unknown;
  deployment: PerplDeployment;
};

export const binSymbols = [...new Set(bins.flatMap((bin) => bin.legs.map((leg) => leg.symbol)))];

export function singleLegBin(symbol: string, direction: "long" | "short", leverage: number): Bin {
  return {
    id: `single-${symbol}`,
    name: symbol,
    thesis: `${direction} ${symbol}`,
    legs: [{ symbol, direction, weightBps: 10000, leverage }],
  };
}

export function sizeBinFor(
  bin: Bin,
  margin: number,
  data: MarketData,
): { sized: SizedBin; issues: BinSizingIssue[] } {
  return sizeBin(bin, margin, data.markets, data.maxLeverage);
}

const marketCacheMs = 15_000;

export function createTerminal(config: TerminalConfig) {
  const { deployment } = config;
  const client = config.publicClient as PublicClient;
  const walletFor = (account: TradingAccount) =>
    config.walletClientFor(account) as WalletClient<Transport, Chain, Account>;

  let cached: { at: number; data: Promise<MarketData> } | null = null;

  function loadMarkets(): Promise<MarketData> {
    if (cached && Date.now() - cached.at < marketCacheMs) return cached.data;
    const data = readMarkets();
    cached = { at: Date.now(), data };
    data.catch(() => {
      if (cached?.data === data) cached = null;
    });
    return data;
  }

  async function readMarkets(): Promise<MarketData> {
    const list = await fetchMarkets(client, deployment.exchange);
    const maxLeverage = new Map<string, number>();
    await Promise.all(
      list.map(async (market) => {
        const terms = await fetchMarginTerms(client, deployment.exchange, market, 1);
        maxLeverage.set(market.symbol, terms.maxLeverage);
      }),
    );
    return { markets: marketsBySymbol(list), maxLeverage };
  }

  function loadAccount(owner: Address): Promise<PerplAccount | null> {
    return fetchAccount(client, deployment.exchange, owner);
  }

  async function loadCollateralBalance(owner: Address): Promise<number> {
    const raw = await client.readContract(balanceOfRequest(deployment.collateral, owner));
    return fromScaled(raw, deployment.collateralDecimals);
  }

  async function loadPositions(owner: Address, data: MarketData): Promise<BinPosition[]> {
    const account = await loadAccount(owner);
    if (account === null) return [];
    const held = await Promise.all(
      bins.map((bin) =>
        fetchBinPosition(client, deployment.exchange, bin, data.markets, account.accountId),
      ),
    );
    return held.filter((position): position is BinPosition => position !== null);
  }

  async function loadOpenPositions(owner: Address, data: MarketData): Promise<OpenPosition[]> {
    const account = await loadAccount(owner);
    if (account === null) return [];
    const found = await Promise.all(
      [...data.markets.values()].map(async (market) => {
        const position = await fetchPosition(client, deployment.exchange, market, account.accountId);
        return position === null ? null : { market, position };
      }),
    );
    return found.filter((entry): entry is OpenPosition => entry !== null);
  }

  async function loadSummary(owner: Address, data: MarketData): Promise<PortfolioSummary> {
    const [wallet, account, open] = await Promise.all([
      loadCollateralBalance(owner),
      loadAccount(owner),
      loadOpenPositions(owner, data),
    ]);
    return {
      total: wallet + (account?.balance ?? 0) + open.reduce((sum, p) => sum + p.position.deposit + p.position.pnl, 0),
      unrealizedPnl: open.reduce((sum, p) => sum + p.position.pnl, 0),
      symbols: open.map((p) => p.market.symbol),
    };
  }

  async function openBin(
    tradingAccount: TradingAccount,
    sized: SizedBin,
    data: MarketData,
    onStep: EntryProgress,
  ): Promise<void> {
    const wallet = walletFor(tradingAccount);
    const owner = tradingAccount.address;
    const descs = binEntryOrders(sized, data.markets, { postOnly: true });
    const total = descs.reduce((sum, desc) => sum + desc.amountCNS, 0n);
    const signer = { chain: wallet.chain, account: tradingAccount.account };

    const allowance = await client.readContract(
      allowanceRequest(deployment.collateral, owner, deployment.exchange),
    );

    if (allowance < total) {
      const hash = await wallet.writeContract({
        ...approveCollateralRequest(deployment.collateral, deployment.exchange, total),
        ...signer,
      });
      onStep("approve", hash);
      await client.waitForTransactionReceipt({ hash });
    }

    const existing = await fetchAccount(client, deployment.exchange, owner);
    const fund = existing
      ? depositCollateralRequest(deployment.exchange, total)
      : createAccountRequest(deployment.exchange, total);
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

  async function closePosition(tradingAccount: TradingAccount, entry: OpenPosition): Promise<Hash> {
    const wallet = walletFor(tradingAccount);
    const descs = binExitOrders([
      { market: entry.market, positionType: entry.position.positionType, lots: entry.position.lots },
    ]);
    const hash = await wallet.writeContract({
      ...execOrdersRequest(deployment.exchange, descs, true),
      chain: wallet.chain,
      account: tradingAccount.account,
    });
    await client.waitForTransactionReceipt({ hash });
    return hash;
  }

  async function loadNativeBalance(owner: Address): Promise<number> {
    return Number(formatEther(await client.getBalance({ address: owner })));
  }

  function checkRecipient(to: string, owner: Address): Address {
    if (!isAddress(to) || to === zeroAddress) throw new Error("Enter a valid Monad address.");
    if (to.toLowerCase() === owner.toLowerCase()) throw new Error("That is your own address.");
    return to;
  }

  async function sendAsset(
    account: TradingAccount,
    input: { asset: "AUSD" | "MON"; to: string; amount: number },
  ): Promise<Hash> {
    const owner = account.address as Address;
    const to = checkRecipient(input.to, owner);
    if (!(input.amount > 0)) throw new Error("Enter an amount.");
    const wallet = walletFor(account);
    const signer = { chain: wallet.chain, account: account.account };
    const gasMon = await loadNativeBalance(owner);
    if (gasMon <= 0) throw new Error("You need a little MON for network fees.");
    let hash: Hash;
    if (input.asset === "AUSD") {
      const have = await loadCollateralBalance(owner);
      if (input.amount > have) throw new Error(`You only have ${have} AUSD in your wallet.`);
      hash = await wallet.writeContract({
        address: deployment.collateral,
        abi: erc20Abi,
        functionName: "transfer",
        args: [to, toScaled(input.amount, deployment.collateralDecimals)],
        ...signer,
      });
    } else {
      if (input.amount > gasMon) throw new Error(`You only have ${gasMon} MON in your wallet.`);
      hash = await wallet.sendTransaction({ to, value: parseEther(String(input.amount)), ...signer });
    }
    await client.waitForTransactionReceipt({ hash });
    return hash;
  }

  async function withdrawFromPerpl(
    account: TradingAccount,
    input: { to: string; amount: number },
    onStep?: (step: "withdraw" | "send", hash: Hash) => void,
  ): Promise<Hash> {
    const owner = account.address as Address;
    const to = checkRecipient(input.to, owner);
    if (!(input.amount > 0)) throw new Error("Enter an amount.");
    const existing = await fetchAccount(client, deployment.exchange, owner);
    if (existing === null) throw new Error("You have no Perpl account yet.");
    if (input.amount > existing.balance) throw new Error(`Only ${existing.balance} AUSD is free to withdraw.`);
    const wallet = walletFor(account);
    const signer = { chain: wallet.chain, account: account.account };
    const withdrawHash = await wallet.writeContract({ ...withdrawCollateralRequest(deployment.exchange, toCNS(input.amount)), ...signer });
    onStep?.("withdraw", withdrawHash);
    await client.waitForTransactionReceipt({ hash: withdrawHash });
    const sendHash = await sendAsset(account, { asset: "AUSD", to, amount: input.amount });
    onStep?.("send", sendHash);
    return sendHash;
  }

  return {
    deployment,
    loadMarkets,
    loadAccount,
    loadCollateralBalance,
    loadPositions,
    loadOpenPositions,
    loadSummary,
    openBin,
    closePosition,
    loadNativeBalance,
    sendAsset,
    withdrawFromPerpl,
  };
}
