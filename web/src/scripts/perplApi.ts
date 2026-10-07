import { perpl } from "shared";
import type { CandleRangeKey, PerpMarket } from "./perpl";

export const apiUrl = "/perpl-api";

export const loadCandles = (market: PerpMarket, range: CandleRangeKey) =>
  perpl.fetchCandles(apiUrl, market, range);
