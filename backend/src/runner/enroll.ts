import { randomUUID } from "node:crypto";
import { perpl } from "shared";
import { verifyTypedData, type Address } from "viem";
import { contextFor, type Net } from "../analytics/context.js";
import { saveKey } from "./vault.js";

const origin = process.env.PERPL_ENROLL_ORIGIN ?? "https://monad.opencash.in";
const ttlMs = 10 * 60_000;

type Entry = { pending: perpl.PendingEnrollment; owner: Address; net: Net; expiresAt: number };

const entries = new Map<string, Entry>();

function prune(now: number) {
  for (const [id, entry] of entries) if (entry.expiresAt < now) entries.delete(id);
}

export async function startEnrollment(owner: Address, net: Net, fetchImpl?: typeof fetch) {
  prune(Date.now());
  const { deployment } = contextFor(net);
  const pending = await perpl.requestEnrollment({
    apiUrl: deployment.apiUrl,
    chainId: deployment.chainId,
    origin,
    address: owner,
    key: perpl.generateTradeKey(),
    label: "OpenCash bots",
    builderId: Number(process.env.PERPL_BUILDER_ID ?? 29),
    maxBuilderFeePer100k: Number(process.env.PERPL_BUILDER_FEE_PER_100K ?? 1),
    fetchImpl,
  });
  const id = randomUUID();
  const expiresAt = Date.now() + ttlMs;
  entries.set(id, { pending, owner, net, expiresAt });
  return { id, signing: perpl.enrollmentSigning(pending.typedData), expiresAt };
}

export async function finishEnrollment(id: string, signature: string, fetchImpl?: typeof fetch) {
  prune(Date.now());
  const entry = entries.get(id);
  if (!entry) throw new Error("This enrollment expired. Start again.");
  const signing = perpl.enrollmentSigning(entry.pending.typedData);
  const valid = await verifyTypedData({ address: entry.owner, ...signing, signature: signature as `0x${string}` } as never);
  if (!valid) throw new Error("The signature is not from that wallet");
  const { deployment } = contextFor(entry.net);
  const result = await perpl.submitEnrollment({ apiUrl: deployment.apiUrl, origin, pending: entry.pending, signature, fetchImpl });
  await saveKey(entry.owner, entry.net, result.apiKey, perpl.secretToHex(entry.pending.key));
  entries.delete(id);
  const forwarding = await perpl
    .createTradeClient({ apiUrl: deployment.apiUrl, chainId: deployment.chainId, apiKey: result.apiKey, secret: entry.pending.key.secret, fetchImpl })
    .account()
    .then((account) => account.forwarding)
    .catch(() => null);
  return { ok: true as const, forwarding };
}
