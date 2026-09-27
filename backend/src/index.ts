import Fastify from "fastify";
import { hoodMainnet } from "shared";
import { agentAccount } from "./chain.js";
import { registerAgentRoute } from "./agent/route.js";
import { registerBoardsRoute } from "./boards/route.js";
import { registerMcpRoute } from "./mcp/route.js";

const port = Number(process.env.PORT ?? 8787);
const app = Fastify({ logger: true });

app.get("/health", async () => ({
  ok: true,
  chainId: hoodMainnet.chainId,
}));

// Public: the address a user authorizes as a session key on their own
// OpenCashDelegate. Never the private key — that stays server-side.
app.get("/agent/address", async () => ({ address: agentAccount().address }));

registerAgentRoute(app);
registerBoardsRoute(app);
registerMcpRoute(app);

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
