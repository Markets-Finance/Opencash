import type { FastifyInstance } from "fastify";
import { createToolbox, defaultLimits, perpl } from "shared";
import { isAddress, type Address } from "viem";
import { contextFor, parseNet } from "../analytics/context.js";
import { limited } from "../runner/route.js";
import { draftWithAgent, type AccountView, type Chat } from "./loop.js";

function provider() {
  if (process.env.OPENAI_API_KEY) {
    return { endpoint: "https://api.openai.com/v1/chat/completions", key: process.env.OPENAI_API_KEY, model: process.env.AGENT_MODEL ?? "gpt-4o-mini" };
  }
  if (process.env.NVIDIA_API_KEY) {
    return { endpoint: "https://integrate.api.nvidia.com/v1/chat/completions", key: process.env.NVIDIA_API_KEY, model: process.env.AGENT_MODEL ?? "openai/gpt-oss-20b" };
  }
  return null;
}

const chatModel: Chat = async (messages, tools) => {
  const active = provider();
  if (!active) throw new Error("agent is not configured");
  const response = await fetch(active.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${active.key}` },
    body: JSON.stringify({ model: active.model, messages, tools, tool_choice: "auto", temperature: 0.2 }),
  });
  if (!response.ok) throw new Error(`Agent model ${response.status}`);
  const body = (await response.json()) as { choices: { message: { content: string | null; tool_calls?: never } }[] };
  return body.choices[0]!.message as never;
};

async function accountView(owner: Address, net: ReturnType<typeof parseNet>): Promise<AccountView> {
  const { client, deployment } = contextFor(net);
  const [account, wallet, mon] = await Promise.all([
    perpl.fetchAccount(client, deployment.exchange, owner).catch(() => null),
    client.readContract(perpl.balanceOfRequest(deployment.collateral, owner)).catch(() => 0n),
    client.getBalance({ address: owner }).catch(() => 0n),
  ]);
  return {
    hasPerplAccount: account !== null,
    perplFreeUsd: account === null ? 0 : Math.max(0, account.balance - account.lockedBalance),
    walletAusd: Number(wallet) / 10 ** deployment.collateralDecimals,
    monBalance: Number(mon) / 1e18,
  };
}

export function registerAgentRoute(app: FastifyInstance): void {
  app.post<{ Body: { prompt?: string; owner?: string; network?: string } }>("/agent/draft", async (request, reply) => {
    if (!provider()) return reply.status(503).send({ error: "agent is not configured" });
    if (limited(request.ip)) return reply.status(429).send({ error: "too many requests" });
    const { prompt = "", owner = "" } = request.body ?? {};
    if (prompt.trim() === "" || prompt.length > 600) return reply.status(400).send({ error: "describe the trade in under 600 characters" });
    if (!isAddress(owner)) return reply.status(400).send({ error: "owner must be an address" });
    const net = parseNet(request.body?.network);
    const toolbox = createToolbox(contextFor(net).api, defaultLimits);
    try {
      return await draftWithAgent(prompt, chatModel, toolbox, () => accountView(owner, net));
    } catch (error) {
      return reply.status(502).send({ error: error instanceof Error ? error.message : "agent failed" });
    }
  });
}
