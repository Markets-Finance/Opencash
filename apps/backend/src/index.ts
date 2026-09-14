import Fastify from "fastify";
import { monadMainnet, monadTestnet } from "shared";

const port = Number(process.env.PORT ?? 8787);
const app = Fastify({ logger: true });

app.get("/health", async () => ({
  ok: true,
  chains: [monadMainnet.id, monadTestnet.id],
}));

app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
