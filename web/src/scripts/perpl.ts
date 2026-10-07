import { createTerminal, perpl } from "shared";
import { publicClient, walletClientFor } from "./chain";

export {
  bins,
  singleLegBin,
  sizeBinFor,
  type Bin,
  type EntryStep,
  type MarketData,
  type OpenPosition,
  type PortfolioSummary,
} from "shared";

export const terminal = createTerminal({
  publicClient,
  walletClientFor,
  deployment: perpl.perplTestnet,
});
