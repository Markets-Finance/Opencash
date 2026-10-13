import type { FastifyInstance } from "fastify";
import { parseSealedRecord, vaultDigest, vaultWriteMessage } from "shared";
import { isAddress, type Address, type Hex } from "viem";
import { verifySigned } from "../auth/signed.js";
import { getVault, putVault } from "./store.js";

const maxBytes = 256 * 1024;
const namespacePattern = /^[a-z0-9.:_-]{3,96}$/;

type PutBody = { record?: unknown; issuedAt?: number; signature?: Hex };

export function registerVaultRoute(app: FastifyInstance): void {
  app.get<{ Params: { owner: string; namespace: string } }>("/vault/:owner/:namespace", async (request, reply) => {
    const { owner, namespace } = request.params;
    if (!isAddress(owner) || !namespacePattern.test(namespace)) return reply.status(400).send({ error: "invalid vault address" });
    const doc = await getVault(owner, namespace);
    if (!doc) return reply.status(404).send({ error: "nothing saved" });
    return { record: doc.record, updatedAt: doc.updatedAt };
  });

  app.put<{ Params: { owner: string; namespace: string }; Body: PutBody }>("/vault/:owner/:namespace", { bodyLimit: maxBytes * 2 }, async (request, reply) => {
    const { owner, namespace } = request.params;
    if (!isAddress(owner) || !namespacePattern.test(namespace)) return reply.status(400).send({ error: "invalid vault address" });
    const { record: raw, issuedAt = 0, signature = "0x" as Hex } = request.body ?? {};
    let record;
    try {
      record = parseSealedRecord(raw);
    } catch {
      return reply.status(400).send({ error: "not a sealed record" });
    }
    if (record.namespace !== namespace) return reply.status(400).send({ error: "namespace mismatch" });
    if (JSON.stringify(record).length > maxBytes) return reply.status(413).send({ error: "vault entry too large" });
    const problem = await verifySigned(owner as Address, vaultWriteMessage(owner, namespace, vaultDigest(record), issuedAt), signature, Date.now());
    if (problem) return reply.status(401).send({ error: problem });
    const updatedAt = Date.now();
    await putVault({ owner, namespace, record, updatedAt });
    return { ok: true, updatedAt };
  });
}
