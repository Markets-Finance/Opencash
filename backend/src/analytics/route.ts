import type { FastifyInstance } from "fastify";
import { parseNet } from "./context.js";
import { leaderboardView, parseSort } from "./leaderboard.js";
import { liquidationsView, positionsView } from "./risk.js";
import { protocolView } from "./protocol.js";
import { storeFor } from "./store.js";
import { walletView } from "./wallet.js";

export function registerAnalyticsRoute(app: FastifyInstance): void {
  storeFor("mainnet");

  app.get<{ Querystring: { network?: string } }>("/analytics/protocol", async (request, reply) => {
    try {
      return await protocolView(parseNet(request.query.network));
    } catch (error) {
      return reply.status(502).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get<{ Querystring: { network?: string } }>("/analytics/liquidations", async (request, reply) => {
    try {
      return await liquidationsView(parseNet(request.query.network));
    } catch (error) {
      return reply.status(502).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get<{ Querystring: { network?: string } }>("/analytics/positions", async (request, reply) => {
    try {
      return await positionsView(parseNet(request.query.network));
    } catch (error) {
      return reply.status(502).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get<{ Querystring: { network?: string; sort?: string; limit?: string } }>("/analytics/leaderboard", async (request, reply) => {
    try {
      return await leaderboardView(parseNet(request.query.network), parseSort(request.query.sort), Math.min(Math.max(Number(request.query.limit) || 10, 1), 50));
    } catch (error) {
      return reply.status(502).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get<{ Querystring: { network?: string; address?: string } }>("/analytics/wallet", async (request, reply) => {
    try {
      const result = await walletView(parseNet(request.query.network), (request.query.address ?? "").trim());
      if ("error" in result) return reply.status(400).send(result);
      return result;
    } catch (error) {
      return reply.status(502).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}
