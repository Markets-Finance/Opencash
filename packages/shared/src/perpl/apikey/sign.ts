import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils.js";
import { base64urlnopad, utf8 } from "@scure/base";

export type TradeKey = { secret: Uint8Array; publicKeyHex: `0x${string}` };

export type SignedHeaders = {
  "X-API-Key": string;
  "X-API-Timestamp": string;
  "X-API-Nonce": string;
  "X-API-Signature": string;
};

export function generateTradeKey(): TradeKey {
  return tradeKeyFromSecret(ed25519.utils.randomSecretKey());
}

export function tradeKeyFromSecret(secret: Uint8Array): TradeKey {
  return { secret, publicKeyHex: `0x${bytesToHex(ed25519.getPublicKey(secret))}` };
}

export function tradeKeyFromHex(secretHex: string): TradeKey {
  return tradeKeyFromSecret(hexToBytes(secretHex.replace(/^0x/, "")));
}

export function secretToHex(key: TradeKey): string {
  return bytesToHex(key.secret);
}

export function canonicalString(input: {
  chainId: number;
  method: string;
  target: string;
  timestamp: string;
  nonce: string;
  body: string;
}): string {
  const bodyHash = bytesToHex(sha256(utf8.decode(input.body)));
  return [input.chainId, input.method.toUpperCase(), input.target, input.timestamp, input.nonce, bodyHash].join("\n");
}

export function signRequest(input: {
  apiKey: string;
  secret: Uint8Array;
  chainId: number;
  method: string;
  target: string;
  body?: string;
  now?: number;
  nonce?: string;
}): SignedHeaders {
  const timestamp = String(input.now ?? Date.now());
  const nonce = input.nonce ?? base64urlnopad.encode(randomBytes(16));
  const canonical = canonicalString({
    chainId: input.chainId,
    method: input.method,
    target: input.target,
    timestamp,
    nonce,
    body: input.body ?? "",
  });
  const signature = ed25519.sign(utf8.decode(canonical), input.secret);
  return {
    "X-API-Key": input.apiKey,
    "X-API-Timestamp": timestamp,
    "X-API-Nonce": nonce,
    "X-API-Signature": base64urlnopad.encode(signature),
  };
}
