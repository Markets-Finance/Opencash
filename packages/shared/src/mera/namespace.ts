import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "@noble/hashes/utils.js";
import { base64urlnopad, utf8 } from "@scure/base";

export type SealedRecord = {
  version: 1;
  namespace: string;
  nonce: string;
  ciphertext: string;
};

export function namespaceSalt(namespace: string): Uint8Array {
  return sha256(utf8.decode(namespace));
}

export function deriveNamespaceKey(
  prfOutput: Uint8Array,
  namespace: string,
): Uint8Array {
  return hkdf(
    sha256,
    prfOutput,
    namespaceSalt(namespace),
    utf8.decode(`terminal.v1.encrypt.${namespace}`),
    32,
  );
}

export function seal(
  key: Uint8Array,
  namespace: string,
  plaintext: string,
): SealedRecord {
  const nonce = randomBytes(12);
  const ciphertext = gcm(key, nonce).encrypt(utf8.decode(plaintext));

  return {
    version: 1,
    namespace,
    nonce: base64urlnopad.encode(nonce),
    ciphertext: base64urlnopad.encode(ciphertext),
  };
}

export function open(key: Uint8Array, record: SealedRecord): string {
  const plaintext = gcm(
    key,
    base64urlnopad.decode(record.nonce),
  ).decrypt(base64urlnopad.decode(record.ciphertext));

  return utf8.encode(plaintext);
}

export function parseSealedRecord(value: unknown): SealedRecord {
  const record = typeof value === "string" ? JSON.parse(value) : value;
  if (
    record === null ||
    typeof record !== "object" ||
    (record as SealedRecord).version !== 1 ||
    typeof (record as SealedRecord).namespace !== "string" ||
    typeof (record as SealedRecord).nonce !== "string" ||
    typeof (record as SealedRecord).ciphertext !== "string"
  ) {
    throw new Error("sealed record is malformed");
  }
  return record as SealedRecord;
}
