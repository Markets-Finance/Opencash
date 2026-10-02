import type { FastifyInstance } from "fastify";
import { isAddress } from "viem";
import { historyForOwner, recordSnapshot } from "./store.js";

export function registerPortfolioRoute(app: FastifyInstance): void {
  app.post<{
    Body: { owner: string; usdgBalance: number; positionsValue: number };
  }>("/portfolio/snapshot", async (request, reply) => {
    const { owner, usdgBalance, positionsValue } = request.body;
    if (!isAddress(owner)) return reply.status(400).send({ error: "invalid owner address" });
    if (!(usdgBalance >= 0) || !(positionsValue >= 0)) {
      return reply.status(400).send({ error: "usdgBalance and positionsValue must be >= 0" });
    }
    return recordSnapshot({ owner, usdgBalance, positionsValue });
  });

  app.get<{ Querystring: { owner: string } }>("/portfolio/history", async (request, reply) => {
    const { owner } = request.query;
    if (!isAddress(owner)) return reply.status(400).send({ error: "invalid owner address" });
    return historyForOwner(owner);
  });
}
