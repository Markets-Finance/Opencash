import type { FastifyInstance } from "fastify";

const upstream = process.env.PERPL_API_URL ?? "https://testnet.perpl.xyz/api";

const allowed = [
  /^\/v1\/pub\/context$/,
  /^\/v1\/market-data\/ticker$/,
  /^\/v1\/market-data\/\d+\/ticker$/,
  /^\/v1\/market-data\/\d+\/book$/,
  /^\/v1\/market-data\/\d+\/candles\/\d+\/\d+-\d+$/,
  /^\/v1\/market-data\/\d+\/funding\/\d+-\d+$/,
];

export function registerPerplRoute(app: FastifyInstance): void {
  app.get<{ Params: { "*": string }; Querystring: { levels?: string } }>("/perpl/*", async (request, reply) => {
    const path = `/${request.params["*"]}`;
    if (!allowed.some((pattern) => pattern.test(path))) {
      return reply.status(400).send({ error: "path not allowed" });
    }
    const levels = request.query.levels;
    const query = levels !== undefined && /^\d+$/.test(levels) ? `?levels=${levels}` : "";
    const response = await fetch(`${upstream}${path}${query}`);
    reply.status(response.status).header("cache-control", "public, max-age=3");
    return response.json();
  });
}
