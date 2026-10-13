import { createTerminal, perpl } from "shared";
import { invalidate } from "./memo";
import { publicClient, walletClientFor } from "./mera";
import { deployment as networkDeployment } from "./network";

export type Candle = perpl.Candle;
export type CandleRangeKey = perpl.CandleRangeKey;
export const candleRanges = perpl.candleRanges;

export {
  binSymbols,
  singleLegBin,
  sizeBinFor,
  type EntryStep,
  type MarketData,
  type OpenPosition,
  type PortfolioSummary,
} from "shared";

export const terminal = createTerminal({ publicClient, walletClientFor, deployment: networkDeployment });

export const {
  deployment,
  loadMarkets,
  loadAccount,
  loadCollateralBalance,
  loadSpendableBalance,
  loadPositions,
  loadOpenPositions,
  loadSummary,
  loadNativeBalance,
} = terminal;

function settled<Args extends unknown[], Result>(action: (...args: Args) => Promise<Result>) {
  return async (...args: Args): Promise<Result> => {
    try {
      return await action(...args);
    } finally {
      invalidate();
    }
  };
}

export const openBin = settled(terminal.openBin);
export const closePosition = settled(terminal.closePosition);
export const sendAsset = settled(terminal.sendAsset);
export const withdrawFromPerpl = settled(terminal.withdrawFromPerpl);

export const loadCandles = (market: perpl.PerpMarket, range: CandleRangeKey) =>
  perpl.fetchCandles(networkDeployment.apiUrl, market, range);
