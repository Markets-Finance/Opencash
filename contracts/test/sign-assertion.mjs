import { p256 } from "../../node_modules/@noble/curves/p256.js";
import { encodeAbiParameters } from "../../node_modules/viem/_esm/index.js";
import { createHash } from "node:crypto";

const PRIVATE_KEY = Buffer.from(
  "c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721",
  "hex",
);
const RP_ID = "terminal.example.xyz";
const ORIGIN = `https://${RP_ID}`;

const digest = process.argv[2];
const flags = process.argv[3] ?? "05";
const rpId = process.argv[4] ?? RP_ID;

const b64url = (b) => Buffer.from(b).toString("base64url");
const sha256 = (b) => createHash("sha256").update(b).digest();

const rpIdHash = sha256(rpId);
const authenticatorData = Buffer.concat([
  rpIdHash,
  Buffer.from(flags, "hex"),
  Buffer.from("00000000", "hex"),
]);

const clientDataJSON = JSON.stringify({
  type: "webauthn.get",
  challenge: b64url(Buffer.from(digest.slice(2), "hex")),
  origin: ORIGIN,
  crossOrigin: false,
});

const message = Buffer.concat([
  authenticatorData,
  sha256(Buffer.from(clientDataJSON, "utf8")),
]);

let sig = p256.sign(sha256(message), PRIVATE_KEY, { prehash: false });
if (sig.hasHighS()) sig = sig.normalizeS();

const pub = p256.getPublicKey(PRIVATE_KEY, false);

process.stdout.write(
  encodeAbiParameters(
    [
      { type: "bytes" },
      { type: "string" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
    ],
    [
      `0x${authenticatorData.toString("hex")}`,
      clientDataJSON,
      BigInt(clientDataJSON.indexOf('"challenge":"')),
      BigInt(clientDataJSON.indexOf('"type":"webauthn.get"')),
      sig.r,
      sig.s,
      BigInt(`0x${Buffer.from(pub.slice(1, 33)).toString("hex")}`),
      BigInt(`0x${Buffer.from(pub.slice(33, 65)).toString("hex")}`),
    ],
  ),
);
