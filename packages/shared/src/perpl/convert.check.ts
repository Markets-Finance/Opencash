import assert from "node:assert/strict";
import { createPublicClient, http } from "viem";
import { monadMainnet } from "../chains.js";
import { mainnetConvert, minimumOut, quoteUsdcToCollateral, swapRequest } from "./convert.js";

assert.equal(minimumOut(1_000_000n, 10), 999_000n);
assert.deepEqual(swapRequest(mainnetConvert, 5n, 4n).args, [1n, 0n, 5n, 4n]);

const client = createPublicClient({ transport: http(monadMainnet.rpcUrl) });
const out = await quoteUsdcToCollateral(client, mainnetConvert, 1_000_000n);
assert.ok(out > 990_000n && out < 1_010_000n, `unexpected quote ${out}`);
console.log("ok", out);
