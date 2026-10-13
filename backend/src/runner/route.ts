import type { FastifyInstance } from "fastify";
import { isUnlockedOwner } from "../referral/store.js";
import { isAddress, verifyMessage, type Address } from "viem";
import {
  botActionMessage,
  botDigest,
  botMandateMessage,
  cardShapeIssues,
  createBot,
  defaultLimits,
  freshSignature,
  perpl,
  tradeKeyMessage,
  tradeKeyRemoveMessage,
  type BotAction,
  type BotMode,
  type StrategyCard,
} from "shared";
import { contextFor, parseNet } from "../analytics/context.js";
import { finishEnrollment, startEnrollment } from "./enroll.js";
import { listLive } from "../live/store.js";
import { runnerActive, startRunner } from "./loop.js";
import { deleteBot, getBot, listBots, saveBot, type ServerBot } from "./store.js";
import { hasKey, removeKey, saveKey } from "./vault.js";

const windowMs = 60_000;
const perWindow = 30;
const hits = new Map<string, { start: number; count: number }>();
export const maxBotsPerOwner = 10;

export function limited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > windowMs) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > perWindow;
}

async function signedBy(owner: string, message: string, signature: string): Promise<boolean> {
  try {
    return await verifyMessage({ address: owner as Address, message, signature: signature as `0x${string}` });
  } catch {
    return false;
  }
}

function publicBot(bot: ServerBot) {
  const { mandate, ...rest } = bot;
  return { ...rest, mandate: { digest: mandate.digest, issuedAt: mandate.issuedAt } };
}

export function registerBotRoute(app: FastifyInstance): void {
  if (process.env.BOT_RUNNER === "1") void startRunner();

  app.get("/bots/status", async () => ({ runner: runnerActive(), enabledByEnv: process.env.BOT_RUNNER === "1" }));

  app.get<{ Querystring: { owner?: string; network?: string } }>("/bots", async (request, reply) => {
    const owner = request.query.owner ?? "";
    if (!isAddress(owner)) return reply.status(400).send({ error: "owner must be a Monad address" });
    const net = parseNet(request.query.network);
    return { bots: (await listBots({ owner, net })).map(publicBot), hasKey: await hasKey(owner, net), runner: runnerActive() };
  });

  app.post<{ Body: { owner?: string; network?: string; apiKey?: string; secret?: string; issuedAt?: number; signature?: string } }>("/bots/key", async (request, reply) => {
    if (limited(request.ip)) return reply.status(429).send({ error: "too many requests" });
    const { owner = "", apiKey = "", secret = "", issuedAt = 0, signature = "" } = request.body ?? {};
    const net = parseNet(request.body?.network);
    if (!isAddress(owner)) return reply.status(400).send({ error: "owner must be a Monad address" });
    if (!/^[0-9a-fA-F]{64}$/.test(secret.replace(/^0x/, "")) || apiKey.length < 8 || apiKey.length > 256) return reply.status(400).send({ error: "invalid key" });
    if (!freshSignature(issuedAt)) return reply.status(400).send({ error: "signature expired" });
    if (!(await signedBy(owner, tradeKeyMessage(owner, net, apiKey, issuedAt), signature))) return reply.status(401).send({ error: "signature does not match the owner" });
    const { deployment } = contextFor(net);
    try {
      const key = perpl.tradeKeyFromHex(secret);
      const account = await perpl.createTradeClient({ apiUrl: deployment.apiUrl, chainId: deployment.chainId, apiKey, secret: key.secret }).account();
      if (!account.forwarding) return reply.status(400).send({ error: "Turn on One-Click Trading for this account first" });
    } catch (error) {
      return reply.status(400).send({ error: `Perpl rejected the key: ${error instanceof Error ? error.message : String(error)}` });
    }
    await saveKey(owner, net, apiKey, secret.replace(/^0x/, ""));
    return { ok: true };
  });

  app.post<{ Body: { owner?: string; network?: string; issuedAt?: number; signature?: string } }>("/bots/key/remove", async (request, reply) => {
    if (limited(request.ip)) return reply.status(429).send({ error: "too many requests" });
    const { owner = "", issuedAt = 0, signature = "" } = request.body ?? {};
    const net = parseNet(request.body?.network);
    if (!isAddress(owner)) return reply.status(400).send({ error: "owner must be a Monad address" });
    if (!freshSignature(issuedAt)) return reply.status(400).send({ error: "signature expired" });
    if (!(await signedBy(owner, tradeKeyRemoveMessage(owner, net, issuedAt), signature))) return reply.status(401).send({ error: "signature does not match the owner" });
    const running = [...(await listBots({ owner, net, enabled: true })), ...(await listLive({ owner, net, enabled: true }))];
    if (running.length > 0) return reply.status(409).send({ error: `Pause your ${running.length} running bot${running.length === 1 ? "" : "s"} first` });
    await removeKey(owner, net);
    return { ok: true };
  });

  app.post<{ Body: { owner?: string; network?: string } }>("/bots/enroll/start", async (request, reply) => {
    if (limited(request.ip)) return reply.status(429).send({ error: "too many requests" });
    const owner = request.body?.owner ?? "";
    if (!isAddress(owner)) return reply.status(400).send({ error: "owner must be a Monad address" });
    try {
      return await startEnrollment(owner, parseNet(request.body?.network));
    } catch (error) {
      return reply.status(502).send({ error: `Perpl did not accept the request: ${error instanceof Error ? error.message : String(error)}` });
    }
  });

  app.post<{ Body: { id?: string; signature?: string } }>("/bots/enroll/finish", async (request, reply) => {
    if (limited(request.ip)) return reply.status(429).send({ error: "too many requests" });
    const { id = "", signature = "" } = request.body ?? {};
    if (!id || !/^0x[0-9a-fA-F]+$/.test(signature)) return reply.status(400).send({ error: "invalid request" });
    try {
      return await finishEnrollment(id, signature);
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post<{ Body: { owner?: string; network?: string; mode?: BotMode; card?: StrategyCard; issuedAt?: number; signature?: string } }>("/bots", async (request, reply) => {
    if (limited(request.ip)) return reply.status(429).send({ error: "too many requests" });
    const { owner = "", card, mode, issuedAt = 0, signature = "" } = request.body ?? {};
    const net = parseNet(request.body?.network);
    if (!isAddress(owner) || !card || (mode !== "guard" && mode !== "auto")) return reply.status(400).send({ error: "invalid request" });
    if (!freshSignature(issuedAt)) return reply.status(400).send({ error: "signature expired" });
    const issues = cardShapeIssues(card, defaultLimits);
    if (issues.length > 0) return reply.status(400).send({ error: issues.join(" ") });
    const digest = botDigest(card, mode);
    if (!(await signedBy(owner, botMandateMessage(owner, net, digest, issuedAt), signature))) return reply.status(401).send({ error: "signature does not match the owner" });
    if ((await listBots({ owner, net })).length + (await listLive({ owner, net })).length >= maxBotsPerOwner && !(await isUnlockedOwner(owner))) return reply.status(400).send({ error: `At most ${maxBotsPerOwner} bots per wallet` });
    const bot: ServerBot = { ...createBot(card.name, mode, card, Date.now()), owner, net, mandate: { digest, signature, issuedAt } };
    await saveBot(bot);
    return publicBot(bot);
  });

  app.post<{ Params: { id: string; action: string }; Body: { issuedAt?: number; signature?: string } }>("/bots/:id/:action", async (request, reply) => {
    if (limited(request.ip)) return reply.status(429).send({ error: "too many requests" });
    const { id, action } = request.params;
    if (action !== "enable" && action !== "disable" && action !== "remove") return reply.status(400).send({ error: "unknown action" });
    const bot = await getBot(id);
    if (!bot) return reply.status(404).send({ error: "bot not found" });
    const { issuedAt = 0, signature = "" } = request.body ?? {};
    if (!freshSignature(issuedAt)) return reply.status(400).send({ error: "signature expired" });
    if (!(await signedBy(bot.owner, botActionMessage(id, action as BotAction, issuedAt), signature))) return reply.status(401).send({ error: "signature does not match the owner" });
    if (action === "remove") {
      await deleteBot(id);
      return { ok: true };
    }
    if (action === "enable" && !(await hasKey(bot.owner, bot.net))) return reply.status(400).send({ error: "Turn on server running first" });
    const next: ServerBot = { ...bot, enabled: action === "enable", status: action === "enable" ? "watching" : "idle", errorStreak: 0 };
    await saveBot(next);
    return publicBot(next);
  });
}

