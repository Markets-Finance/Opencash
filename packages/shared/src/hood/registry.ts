import {
  findStockToken,
  loadStockTokenDirectory,
  type StockTokenEntry,
} from "robinhood-chain-kit";
import { readScaledUiMultiplierState, toUiAmount } from "robinhood-chain-kit/erc8056";
import type { Address, PublicClient } from "viem";
import { fromScaled } from "./scale.js";

export type { StockTokenEntry };

export function loadStockTokens(): Promise<StockTokenEntry[]> {
  return loadStockTokenDirectory();
}

export function tokensBySymbol(
  tokens: readonly StockTokenEntry[],
): Map<string, StockTokenEntry> {
  return new Map(tokens.map((token) => [token.symbol, token]));
}

export function resolveStockToken(
  tokens: readonly StockTokenEntry[],
  symbol: string,
): StockTokenEntry | undefined {
  return findStockToken(tokens, symbol);
}

// Raw ERC-20 balances scale by the ERC-8056 multiplier on corporate actions
// (splits, dividends) — the displayed share count is balance * multiplier,
// not the raw balance itself.
export async function fetchDisplayedBalance(
  client: PublicClient,
  token: Address,
  rawBalance: bigint,
  tokenDecimals: number,
): Promise<number> {
  const state = await readScaledUiMultiplierState(client, token);
  const uiRaw = toUiAmount(rawBalance, state.schedule.multiplier);
  return fromScaled(uiRaw, tokenDecimals);
}
