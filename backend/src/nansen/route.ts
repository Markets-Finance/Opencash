import type { FastifyInstance } from "fastify";
import { isAddress } from "viem";
import { NansenError, nansenStatus } from "./client.js";
import { smartPulse } from "./pulse.js";
import { walletIntel } from "./wallet.js";

const windowMs = 60_000;
const perWindow = 30;
const hits = new Map<string, { start: number; count: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > windowMs) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > perWindow;
}

function failure(error: unknown) {
  if (error instanceof NansenError) return { status: error.status === 503 ? 503 : error.status === 429 ? 429 : 502, body: { error: error.message } };
  return { status: 502, body: { error: error instanceof Error ? error.message : String(error) } };
}

export function registerNansenRoute(app: FastifyInstance): void {
  app.get("/nansen/status", async () => nansenStatus());

  app.get<{ Querystring: { symbols?: string } }>("/nansen/pulse", async (request, reply) => {
    if (limited(request.ip)) return reply.status(429).send({ error: "too many requests" });
    const symbols = (request.query.symbols ?? "")
      .split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter((symbol) => /^[A-Z0-9]{1,12}$/.test(symbol))
      .slice(0, 24);
    if (symbols.length === 0) return reply.status(400).send({ error: "symbols is required" });
    try {
      return await smartPulse(symbols);
    } catch (error) {
      const { status, body } = failure(error);
      return reply.status(status).send(body);
    }
  });

  app.get<{ Querystring: { address?: string; labels?: string } }>("/nansen/wallet", async (request, reply) => {
    if (limited(request.ip)) return reply.status(429).send({ error: "too many requests" });
    const address = (request.query.address ?? "").trim();
    if (!isAddress(address)) return reply.status(400).send({ error: "address must be a Monad address" });
    try {
      return await walletIntel(address, request.query.labels === "1");
    } catch (error) {
      const { status, body } = failure(error);
      return reply.status(status).send(body);
    }
  });
}
