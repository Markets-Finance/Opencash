import type { FastifyInstance } from "fastify";
import { isAddress } from "viem";
import { intents, isDevAuth, signInTradingAccount } from "shared";

const auroraKey = process.env.AURORA_INTENTS_KEY;
const apiKey = process.env.ONECLICK_API_KEY;
const feeBps = Number(process.env.INTENTS_FEE_BPS ?? 0);
const feeRecipient = process.env.INTENTS_FEE_RECIPIENT;
const allowLive = process.env.INTENTS_ALLOW_LIVE === "1";
const aurora = auroraKey ? intents.createAuroraClient({ apiKey: auroraKey }) : null;
const client = aurora ?? intents.createIntentsClient({ apiKey });

const devAddress = isDevAuth ? ((await signInTradingAccount({} as never)).address as string).toLowerCase() : null;
const tokenTtlMs = 300_000;
const windowMs = 60_000;
const perWindow = 30;
const hits = new Map<string, { start: number; count: number }>();

let tokens: { at: number; value: intents.FundingSource[]; destinations: intents.IntentsToken[] } | null = null;

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

function appFees() {
  return feeBps > 0 && feeRecipient ? [{ recipient: feeRecipient, fee: feeBps }] : undefined;
}

export function registerIntentsRoute(app: FastifyInstance): void {
  async function catalog() {
    if (tokens && Date.now() - tokens.at < tokenTtlMs) return tokens;
    const all = await client.getTokens();
    tokens = { at: Date.now(), value: intents.fundingSources(all), destinations: intents.monadDestinations(all) };
    return tokens;
  }

  app.get("/intents/info", async () => ({ provider: aurora ? "aurora" : "near-direct", persistent: aurora !== null }));

  app.post<{ Body: { chain?: string; recipient?: string; originAsset?: string; amount?: string; refundTo?: string } }>("/intents/deposit-address", async (request, reply) => {
    if (limited(request.ip)) return reply.status(429).send({ error: "too many requests" });
    if (!aurora) return reply.status(503).send({ error: "Set AURORA_INTENTS_KEY to create deposit addresses." });
    const { chain = "", recipient = "" } = request.body ?? {};
    if (!isAddress(recipient)) return reply.status(400).send({ error: "recipient must be a Monad address" });
    const { value } = await catalog();
    if (!value.some((token) => token.blockchain === chain)) return reply.status(400).send({ error: "unsupported source chain" });
    try {
      const persistent = await aurora.createPersistentAddress({
        recipient,
        sender: recipient.toLowerCase(),
        depositChain: intents.isEvmChain(chain) ? "evm" : chain,
        destinationChain: "monad",
        destinationAsset: intents.monadUsdcAssetId,
      });
      return { kind: "persistent", ...persistent };
    } catch (error) {
      if (!(error instanceof intents.AuroraError && error.status === 403)) {
        return reply.status(502).send({ error: error instanceof Error ? error.message : String(error) });
      }
    }
    if (!allowLive) {
      return reply.status(403).send({ error: "Aurora has not approved persistent addresses for this organisation, and live one-time deposits are switched off.", approved: false });
    }
    if (devAddress !== null && recipient.toLowerCase() === devAddress) {
      return reply.status(403).send({ error: "This is the shared dev account. Its key is public, so real funds are not accepted here." });
    }
    const { originAsset = "", amount = "", refundTo = "" } = request.body ?? {};
    if (!value.some((token) => token.assetId === originAsset)) return reply.status(400).send({ error: "unsupported origin asset" });
    if (!/^\d{1,40}$/.test(amount) || BigInt(amount) <= 0n) return reply.status(400).send({ error: "invalid amount" });
    if (refundTo.length < 8 || refundTo.length > 128) return reply.status(400).send({ error: "invalid refund address" });
    try {
      const { quote } = await aurora.requestQuote({
        originAsset,
        destinationAsset: intents.monadUsdcAssetId,
        amount,
        recipient,
        refundTo,
        dry: false,
      });
      if (!quote.depositAddress) return reply.status(502).send({ error: "Aurora did not return a deposit address" });
      return { kind: "one-time", depositAddress: quote.depositAddress, memo: quote.depositMemo, deadline: quote.deadline, amountIn: quote.amountInFormatted, amountOut: quote.amountOutFormatted };
    } catch (error) {
      return reply.status(502).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get<{ Querystring: { address?: string } }>("/intents/deposits", async (request, reply) => {
    if (limited(request.ip)) return reply.status(429).send({ error: "too many requests" });
    const address = request.query.address ?? "";
    if (!aurora || address.length < 8 || address.length > 128) return reply.status(400).send({ error: "invalid request" });
    try {
      const [received, success] = await Promise.all([aurora.persistentDeposits(address, "received"), aurora.persistentDeposits(address, "success")]);
      return { received, success };
    } catch (error) {
      return reply.status(502).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/intents/tokens", async () => {
    const { value, destinations } = await catalog();
    return { sources: value, destinations };
  });

  app.post<{ Body: { originAsset?: string; destinationAsset?: string; amount?: string; recipient?: string; refundTo?: string; dry?: boolean } }>(
    "/intents/quote",
    async (request, reply) => {
      if (limited(request.ip)) return reply.status(429).send({ error: "too many requests" });
      const { originAsset = "", destinationAsset = intents.monadUsdcAssetId, amount = "", recipient = "", refundTo = "" } = request.body ?? {};
      const dry = allowLive ? (request.body?.dry ?? true) : true;
      if (!isAddress(recipient)) return reply.status(400).send({ error: "recipient must be a Monad address" });
      if (!/^\d{1,40}$/.test(amount) || BigInt(amount) <= 0n) return reply.status(400).send({ error: "invalid amount" });
      if (refundTo.length < 8 || refundTo.length > 128) return reply.status(400).send({ error: "invalid refund address" });
      const { value, destinations } = await catalog();
      if (!value.some((token) => token.assetId === originAsset)) return reply.status(400).send({ error: "unsupported origin asset" });
      if (!destinations.some((token) => token.assetId === destinationAsset)) return reply.status(400).send({ error: "unsupported destination asset" });
      try {
        return await client.requestQuote({
          originAsset,
          destinationAsset,
          amount,
          recipient,
          refundTo,
          dry,
          appFees: appFees(),
        });
      } catch (error) {
        return reply.status(502).send({ error: error instanceof Error ? error.message : String(error) });
      }
    },
  );

  app.get<{ Querystring: { depositAddress?: string; depositMemo?: string } }>("/intents/status", async (request, reply) => {
    if (limited(request.ip)) return reply.status(429).send({ error: "too many requests" });
    const { depositAddress = "", depositMemo } = request.query;
    if (depositAddress.length < 8 || depositAddress.length > 128) return reply.status(400).send({ error: "invalid deposit address" });
    try {
      return await client.getStatus(depositAddress, depositMemo);
    } catch (error) {
      return reply.status(502).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });
}
