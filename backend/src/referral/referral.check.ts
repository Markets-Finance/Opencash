import { referralMessage } from "shared";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const base = process.env.VAULT_URL ?? "http://localhost:8799";
const code = process.env.CHECK_CODE ?? "";
const account = privateKeyToAccount(generatePrivateKey());
const post = (path: string, body: unknown) => fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function redeem(entered: string, signer = account) {
  const issuedAt = Date.now();
  const signature = await signer.signMessage({ message: referralMessage(account.address, entered, issuedAt) });
  return post("/referral/redeem", { owner: account.address, code: entered, issuedAt, signature });
}

console.log("check wrong", (await post("/referral/check", { code: "nope" })).status);
console.log("check right", (await post("/referral/check", { code })).status);
console.log("before", await (await fetch(`${base}/referral/${account.address}`)).json());
console.log("redeem wrong", (await redeem("nope")).status);
console.log("redeem by stranger", (await redeem(code, privateKeyToAccount(generatePrivateKey()))).status);
console.log("redeem right", (await redeem(code.toLowerCase())).status);
console.log("after", await (await fetch(`${base}/referral/${account.address}`)).json());
