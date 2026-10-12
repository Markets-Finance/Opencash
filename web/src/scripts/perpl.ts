import { createTerminal, perpl } from "shared";
import { deployment } from "../data/network";
import { publicClient, walletClientFor } from "./chain";

export {
  cardDigestInput,
  followMessage,
  publishMessage,
  unfollowMessage,
  createBot,
  createBotRuntime,
  type Bot,
  type BotMode,
  type BotRuntime,
  bins,
  binFromCard,
  cardFromBin,
  ruleDrafter,
  type StrategyCard,
  type StrategyLeg,
  singleLegBin,
  sizeBinFor,
  type Bin,
  type EntryStep,
  type MarketData,
  type OpenPosition,
  type PortfolioSummary,
} from "shared";

export type PerpMarket = perpl.PerpMarket;
export type Candle = perpl.Candle;
export type CandleRangeKey = perpl.CandleRangeKey;

export const terminal = createTerminal({
  publicClient,
  walletClientFor,
  deployment,
});
