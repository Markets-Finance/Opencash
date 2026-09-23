export type P256PublicKey = {
  x: bigint;
  y: bigint;
};

const spkiP256Header = "3059301306072a8648ce3d020106082a8648ce3d030107034200";

const coseX = -2;
const coseY = -3;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function toBigInt(coordinate: Uint8Array): bigint {
  if (coordinate.length !== 32) {
    throw new Error("P-256 coordinate is not 32 bytes");
  }
  return BigInt(`0x${toHex(coordinate)}`);
}

export function parseSpkiP256PublicKey(spki: Uint8Array): P256PublicKey {
  if (spki.length !== 91 || !toHex(spki).startsWith(spkiP256Header)) {
    throw new Error("not a P-256 SubjectPublicKeyInfo");
  }
  if (spki[26] !== 0x04) {
    throw new Error("public key is not an uncompressed point");
  }

  return {
    x: toBigInt(spki.subarray(27, 59)),
    y: toBigInt(spki.subarray(59, 91)),
  };
}

type CborValue = number | string | Uint8Array | Map<number | string, CborValue>;

type CborReader = { bytes: Uint8Array; offset: number };

function readArgument(reader: CborReader, info: number): number {
  if (info < 24) return info;

  const width = { 24: 1, 25: 2, 26: 4 }[info];
  if (width === undefined) throw new Error("unsupported CBOR argument");

  let value = 0;
  for (let i = 0; i < width; i++) {
    value = value * 256 + (reader.bytes[reader.offset + i] ?? 0);
  }
  reader.offset += width;
  return value;
}

function readValue(reader: CborReader): CborValue {
  const initial = reader.bytes[reader.offset];
  if (initial === undefined) throw new Error("CBOR ended early");
  reader.offset += 1;

  const major = initial >> 5;
  const argument = readArgument(reader, initial & 0x1f);

  if (major === 0) return argument;
  if (major === 1) return -1 - argument;

  if (major === 2 || major === 3) {
    const slice = reader.bytes.subarray(reader.offset, reader.offset + argument);
    reader.offset += argument;
    return major === 2 ? slice : String.fromCharCode(...slice);
  }

  if (major === 5) {
    const map = new Map<number | string, CborValue>();
    for (let i = 0; i < argument; i++) {
      const key = readValue(reader);
      const value = readValue(reader);
      if (typeof key === "number" || typeof key === "string") map.set(key, value);
    }
    return map;
  }

  throw new Error(`unsupported CBOR major type ${major}`);
}

export function parseCoseP256PublicKey(cose: Uint8Array): P256PublicKey {
  const value = readValue({ bytes: cose, offset: 0 });
  if (!(value instanceof Map)) throw new Error("COSE key is not a map");

  const x = value.get(coseX);
  const y = value.get(coseY);
  if (!(x instanceof Uint8Array) || !(y instanceof Uint8Array)) {
    throw new Error("COSE key has no P-256 coordinates");
  }

  return { x: toBigInt(x), y: toBigInt(y) };
}

export function parseAttestedPublicKey(
  attestationObject: Uint8Array,
): P256PublicKey {
  const decoded = readValue({ bytes: attestationObject, offset: 0 });
  if (!(decoded instanceof Map)) {
    throw new Error("attestation object is not a map");
  }

  const authData = decoded.get("authData");
  if (!(authData instanceof Uint8Array)) {
    throw new Error("attestation object has no authData");
  }
  if ((authData[32] ?? 0) & 0x40) {
    const length = (authData[53] ?? 0) * 256 + (authData[54] ?? 0);
    return parseCoseP256PublicKey(authData.subarray(55 + length));
  }

  throw new Error("authData carries no attested credential data");
}

export function relyingPartyIdHash(authenticatorData: Uint8Array): string {
  if (authenticatorData.length < 37) {
    throw new Error("authenticator data is too short");
  }
  return `0x${toHex(authenticatorData.subarray(0, 32))}`;
}
