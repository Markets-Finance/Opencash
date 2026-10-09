import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import { hexToBytes } from "@noble/hashes/utils.js";
import { perpl } from "shared";
import { hashTypedData } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

process.env.BOT_KEY_SECRET = randomBytes(32).toString("hex");
const { startEnrollment, finishEnrollment } = await import("./enroll.js");
const { loadKey } = await import("./vault.js");
process.chdir(mkdtempSync(join(tmpdir(), "enroll-")));

const owner = privateKeyToAccount(generatePrivateKey());
const typed = {
  types: { EIP712Domain: [{ name: "name", type: "string" }], ApiKey: [{ name: "publicKey", type: "bytes" }] },
  domain: { name: "Perpl" },
  primaryType: "ApiKey",
  message: { publicKey: "0x1234" },
};
const calls: { url: string; origin: string; body: any }[] = [];
const fake = (async (url: string, init: any) => {
  const body = JSON.parse(init.body ?? "{}");
  calls.push({ url: String(url), origin: init.headers?.Origin, body });
  if (String(url).endsWith("/v1/api-key/payload")) return new Response(JSON.stringify({ typed_data: typed, mac: "m1" }), { status: 200 });
  if (String(url).endsWith("/v1/api-key/enroll")) return new Response(JSON.stringify({ api_key: { api_key: "perpl-token-xyz", origin: "https://monad.opencash.in" } }), { status: 200 });
  if (String(url).endsWith("/v1/trading/wallet")) return new Response(JSON.stringify({ sn: 5, as: [{ id: 3, fw: false, fr: false, lfr: 0, b: 0, lb: 0 }] }), { status: 200 });
  return new Response("nope", { status: 404 });
}) as never;

const started = await startEnrollment(owner.address, "mainnet", fake);
console.assert(calls[0].origin === "https://monad.opencash.in", "enrollment is requested from the whitelisted origin", calls[0].origin);
console.assert(calls[0].body.scope_mask === 2 && calls[0].body.chain_id === 143 && calls[0].body.address === owner.address, "trade scope on the right chain", calls[0].body);
console.assert(!("EIP712Domain" in started.signing.types), "the signing request has no domain type");

const wrong = privateKeyToAccount(generatePrivateKey());
const badSignature = await wrong.signTypedData(started.signing as never);
console.assert(await finishEnrollment(started.id, badSignature, fake).then(() => "", (error: Error) => error.message).then((message) => message.includes("not from that wallet")), "a signature from another wallet is refused");
console.assert(calls.every((call) => !call.url.endsWith("/enroll")), "nothing is sent to Perpl for a bad signature");

const signature = await owner.signTypedData(started.signing as never);
const done = await finishEnrollment(started.id, signature, fake);
console.assert(done.ok && done.forwarding === false, "finishing reports that One-Click Trading is still off", done);
const enroll = calls.find((call) => call.url.endsWith("/enroll"))!;
const key = await loadKey(owner.address, "mainnet");
console.assert(key?.apiKey === "perpl-token-xyz" && key.secretHex.length === 64, "the key is saved in the vault");
const publicKey = perpl.tradeKeyFromHex(key!.secretHex).publicKeyHex;
const digest = hashTypedData(perpl.enrollmentSigning(typed as never) as never);
console.assert(ed25519.verify(hexToBytes(enroll.body.pop_signature.slice(2)), hexToBytes(digest.slice(2)), hexToBytes(publicKey.slice(2))), "proof of possession is made with the saved key");
console.assert(enroll.body.signature === signature && enroll.body.mac === "m1", "wallet signature and mac are forwarded");
console.assert(await finishEnrollment(started.id, signature, fake).then(() => "", (error: Error) => error.message).then((message) => message.includes("expired")), "an enrollment can only be finished once");
console.log("ok");
