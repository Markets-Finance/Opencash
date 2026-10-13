import { deriveNamespaceKey, openSealed as open, seal, vaultDigest, vaultWriteMessage } from "shared";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const base = process.env.VAULT_URL ?? "http://localhost:8799";
const namespace = "opencash.check.v1";
const account = privateKeyToAccount(generatePrivateKey());
const prf = crypto.getRandomValues(new Uint8Array(32));

async function put(record: unknown, signer = account, issuedAt = Date.now()) {
  const message = vaultWriteMessage(account.address, namespace, vaultDigest(record), issuedAt);
  const signature = await signer.signMessage({ message });
  return fetch(`${base}/vault/${account.address}/${namespace}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ record, issuedAt, signature }) });
}

const key = deriveNamespaceKey(prf, namespace);
const record = seal(key, namespace, "note: long MON at 0.02");
const saved = await put(record);
console.log("save", saved.status);
const fetched = (await (await fetch(`${base}/vault/${account.address}/${namespace}`)).json()) as { record: typeof record };
console.log("restore", open(deriveNamespaceKey(prf, namespace), fetched.record));
console.log("server sees plaintext", JSON.stringify(fetched).includes("long MON"));
console.log("stranger write", (await put(seal(key, namespace, "evil"), privateKeyToAccount(generatePrivateKey()))).status);
console.log("stale write", (await put(record, account, Date.now() - 3_600_000)).status);
console.log("other namespace read", (await fetch(`${base}/vault/${account.address}/opencash.other.v1`)).status);
