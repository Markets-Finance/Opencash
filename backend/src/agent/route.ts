import type { FastifyInstance } from "fastify";
import { binById } from "shared";
import { isAddress } from "viem";
import { createMandate, getMandate, listMandatesForOwner } from "./mandates.js";
import { getProposal } from "./proposals.js";
import { proposeAction } from "./propose.js";
import { receiptsForMandate } from "./receipts.js";

export function registerAgentRoute(app: FastifyInstance): void {
  app.post<{
    Body: { owner: string; binId: string; policyText: string; usdgBudget: number };
  }>("/mandates", async (request, reply) => {
    const { owner, binId, policyText, usdgBudget } = request.body;
    if (!isAddress(owner)) return reply.status(400).send({ error: "invalid owner address" });
    if (!binById(binId)) return reply.status(400).send({ error: `Unknown bin "${binId}"` });
    if (!policyText || policyText.trim() === "")
      return reply.status(400).send({ error: "policyText is required" });
    if (!(usdgBudget > 0)) return reply.status(400).send({ error: "usdgBudget must be > 0" });

    // Manual-approval only, on purpose: autoExecute is never set from this
    // route. Unattended execution needs OpenCashDelegate deployed, which
    // isn't live yet — every mandate created here requires a human tap on
    // /mandates/:id/propose's result to actually move funds.
    return createMandate({ owner, binId, policyText: policyText.trim(), usdgBudget });
  });

  app.get<{ Querystring: { owner: string } }>("/mandates", async (request, reply) => {
    const { owner } = request.query;
    if (!isAddress(owner)) return reply.status(400).send({ error: "invalid owner address" });
    return listMandatesForOwner(owner);
  });

  app.get<{ Params: { id: string } }>("/mandates/:id", async (request, reply) => {
    const mandate = await getMandate(request.params.id);
    if (!mandate) return reply.status(404).send({ error: "not found" });
    return mandate;
  });

  app.post<{ Params: { id: string } }>("/mandates/:id/propose", async (request, reply) => {
    try {
      return await proposeAction(request.params.id);
    } catch (error) {
      return reply.status(400).send({ error: (error as Error).message });
    }
  });

  app.get<{ Params: { id: string } }>("/mandates/:id/receipts", async (request) => {
    return receiptsForMandate(request.params.id);
  });

  app.get<{ Params: { id: string } }>("/proposals/:id", async (request, reply) => {
    const proposal = await getProposal(request.params.id);
    if (!proposal) return reply.status(404).send({ error: "not found" });
    return proposal;
  });
}
