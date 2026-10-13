import assert from "node:assert/strict";
import { grantGas, type GasSender } from "./gas.js";

const owner = "0x000000000000000000000000000000000000dEaD";
const sent: bigint[] = [];
const sender = (balance: bigint, fail = false): GasSender => ({
  balanceOf: async () => balance,
  send: async (_to, amount) => {
    if (fail) throw new Error("boom");
    sent.push(amount);
    return "0xabc" as never;
  },
});

assert.equal((await grantGas(owner, null)).sent, false);
assert.equal((await grantGas(owner, sender(0n))).sent, true);
assert.equal(sent.length, 1);
assert.equal((await grantGas(owner, sender(10n ** 20n))).reason, "already has gas");
assert.equal((await grantGas(owner, sender(0n, true))).sent, false);
process.env.GAS_GRANT_DAILY_CAP = "1";
assert.equal((await grantGas(owner, sender(0n))).reason, "daily gas limit reached");
console.log("gas: ok");
