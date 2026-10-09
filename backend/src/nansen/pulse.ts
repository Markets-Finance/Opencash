import { nansen as shared } from "shared";
import { NansenError, nansen } from "./client.js";

const ttlMs = (Number(process.env.NANSEN_PULSE_TTL_MIN) || 120) * 60_000;
const fallbackChains = ["monad", "ethereum", "solana", "base", "arbitrum", "bnb", "hyperevm"];

function bodies() {
  const filters = { include_native_tokens: true, include_stablecoins: false };
  const page = { page: 1, per_page: 1000 };
  const order = [{ field: "trader_count", direction: "DESC" }];
  return [
    { chains: ["all"], filters, pagination: page, order_by: order },
    { chains: ["all"], filters, pagination: page },
    { chains: fallbackChains, filters, pagination: page },
  ];
}

let working = 0;

export async function smartPulse(symbols: string[]) {
  const options = bodies();
  let failure: unknown = null;
  for (let index = working; index < options.length; index += 1) {
    try {
      const reply = await nansen<{ data: shared.NetflowRow[] }>("/smart-money/netflow", options[index], ttlMs, 5);
      working = index;
      return { pulses: shared.pulseFromRows(symbols, reply.value.data ?? []), cached: reply.cached, credits: reply.credits, at: reply.at, rows: reply.value.data?.length ?? 0 };
    } catch (error) {
      failure = error;
      if (!(error instanceof NansenError) || ![400, 422].includes(error.status)) break;
    }
  }
  throw failure;
}
