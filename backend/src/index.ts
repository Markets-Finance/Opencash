import cors from "@fastify/cors";
import Fastify from "fastify";
import { chainFor, networkFrom } from "shared";
import { registerAccountRoute } from "./account/route.js";
import { registerVaultRoute } from "./vault/route.js";
import { registerAnalyticsRoute } from "./analytics/route.js";
import { registerBoardsRoute } from "./boards/route.js";
import { registerLeaderboardRoute } from "./leaderboard/route.js";
import { registerMarketRoute } from "./market/route.js";
import { warmTradableCache } from "./market/tradable.js";
import { registerIdentityRoute } from "./identity/route.js";
import { killed } from "./kill.js";
import { registerIntentsRoute } from "./intents/route.js";
import { registerNansenRoute } from "./nansen/route.js";
import { registerLiveRoute } from "./live/route.js";
import { registerBotRoute } from "./runner/route.js";
import { registerStrategyRoute } from "./strategies/route.js";
import { registerPerplRoute } from "./perpl/route.js";
import { registerPortfolioRoute } from "./portfolio/route.js";

const port = Number(process.env.PORT ?? 8787);
const app = Fastify({ logger: true });

await app.register(cors, { origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true });

app.addHook("onRequest", async (request, reply) => {
  if (killed() && request.url.split("?")[0] !== "/health") return reply.status(404).send({ error: "Not found" });
});

app.get("/health", async () => ({
  ok: true,
  chainId: chainFor(networkFrom(process.env.NETWORK)).id,
  killed: killed(),
}));

registerBoardsRoute(app);
registerMarketRoute(app);
registerPortfolioRoute(app);
registerPerplRoute(app);
registerIdentityRoute(app);
registerLeaderboardRoute(app);
registerStrategyRoute(app);
registerIntentsRoute(app);
registerAnalyticsRoute(app);
registerNansenRoute(app);
registerBotRoute(app);
registerLiveRoute(app);
registerAccountRoute(app);
registerVaultRoute(app);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

warmTradableCache();
