import type { FastifyInstance } from "fastify";
import type { VerifiedLink } from "shared";
import { JsonFileStore } from "../store/jsonFile.js";
import { currentRanking, syncLedger } from "./sync.js";

const links = new JsonFileStore<VerifiedLink>("data/identity-links.json");
const syncEveryMs = 60_000;

export function registerLeaderboardRoute(app: FastifyInstance): void {
  const run = () => syncLedger().catch((error) => app.log.error(error, "ledger sync failed"));
  void run();
  setInterval(run, syncEveryMs);

  app.get<{ Querystring: { limit?: string } }>("/leaderboard", async (request) => {
    const limit = Math.min(100, Math.max(1, Number(request.query.limit) || 25));
    const { stats, syncedAt, network, windowHours } = await currentRanking();
    const handles = new Map((await links.all()).map((link) => [link.address.toLowerCase(), link.handle]));
    return {
      network,
      windowHours,
      syncedAt,
      rows: stats.slice(0, limit).map((s, index) => ({
        rank: index + 1,
        accountId: s.accountId,
        address: s.address,
        handle: s.address ? (handles.get(s.address.toLowerCase()) ?? null) : null,
        netPnlUsd: s.netPnlUsd,
        grossPnlUsd: s.grossPnlUsd,
        feesUsd: s.feesUsd,
        volumeUsd: s.volumeUsd,
        closedTrades: s.closedTrades,
        winRate: s.winRate,
        profitFactor: s.profitFactor,
        maxDrawdownUsd: s.maxDrawdownUsd,
        liquidations: s.liquidations,
      })),
    };
  });
}
