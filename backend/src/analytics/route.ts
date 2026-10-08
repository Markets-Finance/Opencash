import type { FastifyInstance } from "fastify";
import { parseNet } from "./context.js";
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
