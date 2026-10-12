import { createTerminal, perpl } from "shared";
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
  openBin,
  closePosition,
  loadNativeBalance,
  sendAsset,
  withdrawFromPerpl,
} = terminal;

export const loadCandles = (market: perpl.PerpMarket, range: CandleRangeKey) =>
  perpl.fetchCandles(networkDeployment.apiUrl, market, range);
