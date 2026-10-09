import { ed25519 } from "@noble/curves/ed25519.js";
import { hexToBytes, bytesToHex } from "@noble/hashes/utils.js";
import { hashTypedData, type Hex, type LocalAccount } from "viem";
import type { TradeKey } from "./sign.js";

export const scopeRead = 1;
export const scopeTrade = 2;

type TypedData = {
  domain: Record<string, unknown>;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
};

export type EnrollInput = {
  apiUrl: string;
  chainId: number;
  origin: string;
  account: Pick<LocalAccount, "address" | "signTypedData">;
  key: TradeKey;
  label: string;
  scopeMask?: number;
  expiresAt?: number;
  fetchImpl?: typeof fetch;
};

async function post<T>(fetchImpl: typeof fetch, url: string, origin: string, body: unknown): Promise<T> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Perpl ${response.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

export async function enrollTradeKey(input: EnrollInput): Promise<{ apiKey: string; origin: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const base = input.apiUrl.replace(/\/$/, "");
  const address = input.account.address;
  const payload = await post<{ typed_data: TypedData; mac: string }>(fetchImpl, `${base}/v1/api-key/payload`, input.origin, {
    chain_id: input.chainId,
    address,
    public_key: input.key.publicKeyHex,
    scope_mask: input.scopeMask ?? scopeTrade,
    label: input.label,
    ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
  });

  const { EIP712Domain: _domain, ...types } = payload.typed_data.types;
  const typed = {
    domain: payload.typed_data.domain,
    types,
    primaryType: payload.typed_data.primaryType,
    message: payload.typed_data.message,
  };
  const signature = await input.account.signTypedData(typed as never);
  const digest = hashTypedData(typed as never);
  const proof = ed25519.sign(hexToBytes(digest.slice(2)), input.key.secret);

  const enrolled = await post<{ api_key: { api_key: string; origin: string } }>(fetchImpl, `${base}/v1/api-key/enroll`, input.origin, {
    chain_id: input.chainId,
    address,
    typed_data: payload.typed_data,
    mac: payload.mac,
    signature: signature as Hex,
    pop_signature: `0x${bytesToHex(proof)}`,
  });
  return { apiKey: enrolled.api_key.api_key, origin: enrolled.api_key.origin };
}
