import type { FastifyInstance } from "fastify";
import { referralMessage } from "shared";
import { isAddress, type Address, type Hex } from "viem";
import { verifySigned } from "../auth/signed.js";
import { grantGas } from "../relayer/gas.js";
import { limited } from "../runner/route.js";
import { isUnlockedOwner, redeem, validCode } from "./store.js";

type Body = { owner?: Address; code?: string; issuedAt?: number; signature?: Hex };

export function registerReferralRoute(app: FastifyInstance): void {
  app.get<{ Params: { owner: string } }>("/referral/:owner", async (request, reply) => {
    if (!isAddress(request.params.owner)) return reply.status(400).send({ error: "invalid owner" });
    return { unlocked: await isUnlockedOwner(request.params.owner) };
  });

  app.post<{ Body: { code?: string } }>("/referral/check", async (request, reply) => {
    if (limited(request.ip)) return reply.status(429).send({ error: "Too many tries, wait a minute" });
    const code = request.body?.code ?? "";
    if (code.trim() === "" || code.length > 64 || !validCode(code)) return reply.status(403).send({ error: "That referral code is not valid" });
    return { valid: true };
  });

  app.post<{ Body: Body }>("/referral/redeem", async (request, reply) => {
    if (limited(request.ip)) return reply.status(429).send({ error: "Too many tries, wait a minute" });
    const { owner = "" as Address, code = "", issuedAt = 0, signature = "0x" as Hex } = request.body ?? {};
    if (!isAddress(owner) || code.trim() === "" || code.length > 64) return reply.status(400).send({ error: "invalid request" });
    const problem = await verifySigned(owner, referralMessage(owner, code, issuedAt), signature, Date.now());
    if (problem) return reply.status(401).send({ error: problem });
    if (!validCode(code)) return reply.status(403).send({ error: "That referral code is not valid" });
    const first = !(await isUnlockedOwner(owner));
    await redeem(owner, code);
    const gas = first ? await grantGas(owner) : { sent: false, reason: "already redeemed" };
    return { unlocked: true, gas: { sent: gas.sent, hash: gas.hash } };
  });
}
