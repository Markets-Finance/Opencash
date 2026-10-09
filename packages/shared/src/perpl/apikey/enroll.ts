import { ed25519 } from "@noble/curves/ed25519.js";
import { hexToBytes, bytesToHex } from "@noble/hashes/utils.js";
import { hashTypedData, type LocalAccount } from "viem";
import type { TradeKey } from "./sign.js";

export const scopeRead = 1;
export const scopeTrade = 2;

type TypedData = {
  domain: Record<string, unknown>;
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
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

export type PendingEnrollment = {
  chainId: number;
  address: string;
  typedData: TypedData;
  mac: string;
  key: TradeKey;
};

export function enrollmentSigning(typedData: TypedData) {
  const { EIP712Domain: _domain, ...types } = typedData.types;
  return { domain: typedData.domain, types, primaryType: typedData.primaryType, message: typedData.message };
}

type RequestInput = {
  apiUrl: string;
  chainId: number;
  origin: string;
  address: string;
  key: TradeKey;
  label: string;
  scopeMask?: number;
  expiresAt?: number;
  builderId?: number;
  maxBuilderFeePer100k?: number;
  fetchImpl?: typeof fetch;
};

export async function requestEnrollment(input: RequestInput): Promise<PendingEnrollment> {
  const base = input.apiUrl.replace(/\/$/, "");
  const payload = await post<{ typed_data: TypedData; mac: string }>(input.fetchImpl ?? fetch, `${base}/v1/api-key/payload`, input.origin, {
    chain_id: input.chainId,
    address: input.address,
    public_key: input.key.publicKeyHex,
    scope_mask: input.scopeMask ?? scopeTrade,
    label: input.label,
    ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
    ...(input.builderId ? { builder_id: input.builderId, max_builder_fee_per_100k: input.maxBuilderFeePer100k ?? 0 } : {}),
  });
  return { chainId: input.chainId, address: input.address, typedData: payload.typed_data, mac: payload.mac, key: input.key };
}

export async function submitEnrollment(input: {
  apiUrl: string;
  origin: string;
  pending: PendingEnrollment;
  signature: string;
  fetchImpl?: typeof fetch;
}): Promise<{ apiKey: string; origin: string }> {
  const { pending } = input;
  const digest = hashTypedData(enrollmentSigning(pending.typedData) as never);
  const proof = ed25519.sign(hexToBytes(digest.slice(2)), pending.key.secret);
  const enrolled = await post<{ api_key: { api_key: string; origin: string } }>(
    input.fetchImpl ?? fetch,
    `${input.apiUrl.replace(/\/$/, "")}/v1/api-key/enroll`,
    input.origin,
    {
      chain_id: pending.chainId,
      address: pending.address,
      typed_data: pending.typedData,
      mac: pending.mac,
      signature: input.signature,
      pop_signature: `0x${bytesToHex(proof)}`,
    },
  );
  return { apiKey: enrolled.api_key.api_key, origin: enrolled.api_key.origin };
}

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

export async function enrollTradeKey(input: EnrollInput): Promise<{ apiKey: string; origin: string }> {
  const pending = await requestEnrollment({ ...input, address: input.account.address });
  const signature = await input.account.signTypedData(enrollmentSigning(pending.typedData) as never);
  return submitEnrollment({ apiUrl: input.apiUrl, origin: input.origin, pending, signature, fetchImpl: input.fetchImpl });
}
