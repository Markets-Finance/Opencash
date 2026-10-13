import assert from "node:assert/strict";
import { createToolbox, defaultLimits, perpl } from "shared";
import { draftWithAgent, type Chat } from "./loop.js";

const toolbox = createToolbox(perpl.createPerplApi(perpl.perplMainnet.apiUrl), defaultLimits);
const script: Chat[] = [
  async () => ({ content: null, tool_calls: [{ id: "1", type: "function", function: { name: "my_account", arguments: "{}" } }] }),
  async () => ({ content: null, tool_calls: [{ id: "2", type: "function", function: { name: "list_markets", arguments: "{}" } }] }),
  async () => ({
    content: null,
    tool_calls: [{ id: "3", type: "function", function: { name: "submit_card", arguments: JSON.stringify({ reply: "Long BTC small.", card: { name: "BTC small", thesis: "test", kind: "directional", marginUsd: 10, legs: [{ symbol: "BTC", direction: "long", weightBps: 10000, leverage: 2 }], stopLossPct: 8 } }) } }],
  }),
];
let turn = 0;
const seen: string[] = [];
const chat: Chat = async (messages, tools) => {
  seen.push(String(messages.length));
  assert.ok(tools.length >= 9, "tools offered");
  return script[turn++]!(messages, tools);
};
const result = await draftWithAgent("make a small BTC long", chat, toolbox, async () => ({ hasPerplAccount: true, perplFreeUsd: 10.05, walletAusd: 0.003, monBalance: 0.5 }));
assert.equal(result.card?.legs[0]?.symbol, "BTC");
assert.deepEqual(result.checked.slice(0, 2), ["Checked your balances", "list markets"]);
assert.equal(seen.join(","), "2,4,6");

const stuck = await draftWithAgent("x", async () => ({ content: "I cannot do that", tool_calls: [] }), toolbox, async () => ({ hasPerplAccount: false, perplFreeUsd: 0, walletAusd: 0, monBalance: 0 }));
assert.equal(stuck.card, null);
console.log("agent loop: ok");
