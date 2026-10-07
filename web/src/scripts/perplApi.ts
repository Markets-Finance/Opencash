import { perpl } from "shared";
import type { CandleRangeKey, PerpMarket } from "./perpl";

const backend = import.meta.env.PUBLIC_BACKEND_URL ?? "http://localhost:8787";

export const apiUrl = `${backend}/perpl`;

export const loadCandles = (market: PerpMarket, range: CandleRangeKey) =>
  perpl.fetchCandles(apiUrl, market, range);
