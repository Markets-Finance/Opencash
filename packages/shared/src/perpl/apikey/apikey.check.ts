import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { base64urlnopad, utf8 } from "@scure/base";
import { hashTypedData, recoverTypedDataAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { ApiOrderFlag, ApiOrderType, canonicalString, cancelSpec, closeSpec, createTradeClient, enrollTradeKey, generateTradeKey, openSpec, signRequest, tradeKeyFromHex, secretToHex } from "./index.js";
import type { PerpMarket } from "../markets.js";

const key = generateTradeKey();
console.assert(tradeKeyFromHex(secretToHex(key)).publicKeyHex === key.publicKeyHex, "secret round trip");

const headers = signRequest({ apiKey: "tok", secret: key.secret, chainId: 143, method: "post", target: "/v1/trading/orders?x=1", body: '{"d":[]}', now: 1_700_000_000_000, nonce: "abc" });
const canonical = canonicalString({ chainId: 143, method: "POST", target: "/v1/trading/orders?x=1", timestamp: "1700000000000", nonce: "abc", body: '{"d":[]}' });
const lines = canonical.split("\n");
console.assert(lines.length === 6 && lines[0] === "143" && lines[1] === "POST" && lines[5] === bytesToHex(sha256(utf8.decode('{"d":[]}'))), "canonical layout", lines);
console.assert(ed25519.verify(base64urlnopad.decode(headers["X-API-Signature"]), utf8.decode(canonical), hexToBytes(key.publicKeyHex.slice(2))), "request signature verifies");
console.assert(!headers["X-API-Signature"].includes("=") && headers["X-API-Key"] === "tok", "base64url without padding");

const market = { perpId: 16, symbol: "BTC", mark: 80_000, priceDecimals: 1, lotDecimals: 5, name: "BTC", numOrders: 5 } as unknown as PerpMarket;
const open = openSpec({ market, accountId: 7, side: "long", lots: 0.01, leverage: 3, requestId: 11, lastExecBlock: 500 });
console.assert(open.t === ApiOrderType.OpenLong && open.fl === ApiOrderFlag.ImmediateOrCancel && open.lv === 300 && open.s === 1000, "open spec scaling", open);
console.assert(open.p === Math.round(80_000 * 1.01 * 10), "buy limit price is mark plus 100 bps", open.p);
const short = openSpec({ market, accountId: 7, side: "short", lots: 0.01, leverage: 2, requestId: 12, lastExecBlock: 500, flag: ApiOrderFlag.PostOnly });
console.assert(short.t === ApiOrderType.OpenShort && short.p === Math.round(80_000 * 0.99 * 10) && short.fl === 1, "short spec", short);
const close = closeSpec({ market, accountId: 7, side: "long", lots: 0.01, requestId: 13, lastExecBlock: 500 });
console.assert(close.t === ApiOrderType.CloseLong && close.p === Math.round(80_000 * 0.99 * 10) && close.lv === 100, "closing a long sells below mark", close);
console.assert(cancelSpec({ marketId: 16, accountId: 7, orderId: 42, requestId: 14 }).t === ApiOrderType.Cancel, "cancel type");

const wallet = privateKeyToAccount(generatePrivateKey());
const typed = {
  types: { EIP712Domain: [{ name: "name", type: "string" }], ApiKey: [{ name: "publicKey", type: "bytes" }, { name: "label", type: "string" }] },
  domain: { name: "Perpl" },
  primaryType: "ApiKey",
  message: { publicKey: key.publicKeyHex, label: "bot" },
};
let enrolled: any = null;
const enrollFetch = (async (url: string, init: any) => {
  const body = JSON.parse(init.body);
  console.assert(init.headers.Origin === "https://opencash.test", "origin header sent");
  if (String(url).endsWith("/payload")) {
    console.assert(body.public_key === key.publicKeyHex && body.scope_mask === 2 && body.chain_id === 10143, "payload request", body);
    return new Response(JSON.stringify({ typed_data: typed, mac: "mac1" }), { status: 200 });
  }
  enrolled = body;
  return new Response(JSON.stringify({ api_key: { api_key: "token-123", origin: "https://opencash.test" } }), { status: 200 });
}) as never;
const result = await enrollTradeKey({ apiUrl: "https://t.example/api", chainId: 10143, origin: "https://opencash.test", account: wallet, key, label: "bot", fetchImpl: enrollFetch });
console.assert(result.apiKey === "token-123", "enroll returns token");
const { EIP712Domain: _d, ...types } = typed.types;
const recovered = await recoverTypedDataAddress({ domain: typed.domain, types, primaryType: "ApiKey", message: typed.message, signature: enrolled.signature } as never);
console.assert(recovered === wallet.address, "wallet signature recovers the owner", recovered);
const digest = hashTypedData({ domain: typed.domain, types, primaryType: "ApiKey", message: typed.message } as never);
console.assert(ed25519.verify(hexToBytes(enrolled.pop_signature.slice(2)), hexToBytes(digest.slice(2)), hexToBytes(key.publicKeyHex.slice(2))), "proof of possession verifies");
console.assert(enrolled.mac === "mac1", "mac echoed");

const seen: any[] = [];
const tradeFetch = (async (url: string, init: any) => {
  seen.push({ url: String(url), headers: init.headers, body: init.body });
  if (String(url).endsWith("/v1/trading/wallet")) return new Response(JSON.stringify({ sn: 900, as: [{ id: 7, fw: true, fr: false, lfr: 20, b: 5_000_000, lb: 0 }] }), { status: 200 });
  if (String(url).endsWith("/v1/trading/orders") && init.method === "POST") {
    return new Response(JSON.stringify({ mt: 31, status: { code: 0 }, statuses: [{ code: 0 }, { code: 400, error: "unknown market" }] }), { status: 200 });
  }
  return new Response(JSON.stringify({ status: { code: 403, error: "no trade scope" } }), { status: 403 });
}) as never;
const client = createTradeClient({ apiUrl: "https://t.example/api/", chainId: 10143, apiKey: "token-123", secret: key.secret, fetchImpl: tradeFetch, now: () => 1_700_000_000_000 });
const account = await client.account();
console.assert(account.id === 7 && account.forwarding && account.lastRequestId === 20 && account.headBlock === 900, "wallet snapshot parsed", account);
const first = client.nextRequestId(account.lastRequestId);
const second = client.nextRequestId(account.lastRequestId);
console.assert(first === 21 && second === 22, "request ids increase", [first, second]);
const outcome = await client.submit([open, short]);
console.assert(!outcome.ok && outcome.statuses[1].code === 400 && outcome.statuses[0].code === 0, "partial batch is reported per order", outcome);
const post = seen.find((item) => item.url.endsWith("/v1/trading/orders"));
const postCanonical = canonicalString({ chainId: 10143, method: "POST", target: "/v1/trading/orders", timestamp: post.headers["X-API-Timestamp"], nonce: post.headers["X-API-Nonce"], body: post.body });
console.assert(ed25519.verify(base64urlnopad.decode(post.headers["X-API-Signature"]), utf8.decode(postCanonical), hexToBytes(key.publicKeyHex.slice(2))), "the sent order request is signed over its exact body");
console.assert(JSON.parse(post.body).d.length === 2, "batch body");
console.log("ok");
