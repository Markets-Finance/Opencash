import type { nansen as shared } from "shared";
import { nansen, nansenStatus } from "./client.js";

const labelCredits = 100;

const hour = 3_600_000;
const day = 24 * hour;

type Page<T> = { data?: T[] };

function isoDay(offsetDays: number): string {
  return new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export async function walletIntel(address: string, requestLabels: boolean): Promise<shared.WalletIntel & { errors: string[] }> {
  let withLabels = requestLabels;
  const chain = "monad";
  const errors: string[] = [];
  const left = nansenStatus().creditsLeft;
  if (withLabels && left !== null && left < labelCredits) {
    errors.push(`labels need ${labelCredits} credits and only ${left} are left`);
    withLabels = false;
  }
  let credits = 0;
  const attempt = async <T>(name: string, run: () => Promise<{ value: T; credits: number }>): Promise<T | null> => {
    try {
      const reply = await run();
      credits += reply.credits;
      return reply.value;
    } catch (error) {
      errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };

  const [pnl, balances, related, labels] = await Promise.all([
    attempt("pnl", () =>
      nansen<{
        realized_pnl_usd?: number;
        realized_pnl_percent?: number;
        win_rate?: number;
        traded_token_count?: number;
        traded_times?: number;
        top5_tokens?: { token_symbol?: string; realized_pnl?: number }[];
      }>("/profiler/address/pnl-summary", { wallet_address: address, chain, date: { from: isoDay(90), to: isoDay(0) } }, hour, 1),
    ),
    attempt("balances", () =>
      nansen<Page<{ token_symbol?: string; value_usd?: number }>>(
        "/profiler/address/current-balance",
        { address, chain, pagination: { page: 1, per_page: 8 }, order_by: [{ field: "value_usd", direction: "DESC" }] },
        hour,
        1,
      ),
    ),
    attempt("related", () =>
      nansen<Page<{ address: string; address_label?: string | null; relation?: string }>>(
        "/profiler/address/related-wallets",
        { wallet_address: address, chain, pagination: { page: 1, per_page: 8 } },
        day,
        1,
      ),
    ),
    withLabels
      ? attempt("labels", () =>
          nansen<Page<{ label: string; category?: string; kind?: string }>>(
            "/profiler/address/labels",
            { address, chain, pagination: { page: 1, per_page: 100 } },
            day,
            100,
          ),
        )
      : Promise.resolve(null),
  ]);

  return {
    address,
    labels: labels ? (labels.data ?? []).map((row) => ({ label: row.label, category: row.category ?? "", kind: row.kind ?? "" })) : null,
    pnl: pnl
      ? {
          realizedUsd: Number(pnl.realized_pnl_usd) || 0,
          realizedPercent: Number(pnl.realized_pnl_percent) || 0,
          winRate: Number(pnl.win_rate) || 0,
          tradedTokens: Number(pnl.traded_token_count) || 0,
          trades: Number(pnl.traded_times) || 0,
          topTokens: (pnl.top5_tokens ?? []).map((token) => ({ symbol: token.token_symbol ?? "?", realizedUsd: Number(token.realized_pnl) || 0 })),
        }
      : null,
    balances: balances ? (balances.data ?? []).map((row) => ({ symbol: row.token_symbol ?? "?", valueUsd: Number(row.value_usd) || 0 })) : null,
    related: related ? (related.data ?? []).map((row) => ({ address: row.address, label: row.address_label ?? null, relation: row.relation ?? "" })) : null,
    creditsUsed: credits,
    fetchedAt: Date.now(),
    errors,
  };
}
