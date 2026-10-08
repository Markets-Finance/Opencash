import assert from "node:assert/strict";
import { costBps, createIntentsClient, fundingSources, monadUsdcAssetId, toBaseUnits } from "./index.js";

const client = createIntentsClient();
const recipient = "0x126F2E536cF40FBcCa2069D5b47dC6D234F55517";

assert.equal(toBaseUnits(100, 6), "100000000");
assert.equal(toBaseUnits(0.5, 8), "50000000");

const tokens = await client.getTokens();
const sources = fundingSources(tokens);
assert.ok(tokens.some((t) => t.assetId === monadUsdcAssetId && t.blockchain === "monad"), "Monad USDC listed");
console.log(`tokens ${tokens.length}, funding sources ${sources.length}, chains ${new Set(sources.map((s) => s.blockchain)).size}`);

const wanted: [string, string][] = [["eth", "USDC"], ["base", "USDC"], ["sol", "USDC"], ["arb", "ETH"], ["btc", "BTC"], ["sol", "SOL"], ["bsc", "USDT"]];
for (const [chain, symbol] of wanted) {
  const source = sources.find((s) => s.blockchain === chain && s.symbol === symbol);
  if (!source) {
    console.log(chain.padEnd(5), symbol.padEnd(5), "not offered");
    continue;
  }
  const amount = toBaseUnits(100 / source.price, source.decimals);
  try {
    const { quote } = await client.requestQuote({ originAsset: source.assetId, destinationAsset: monadUsdcAssetId, amount, recipient, refundTo: recipient, dry: true });
    const cost = costBps(quote);
    console.log(chain.padEnd(5), symbol.padEnd(5), `in $${Number(quote.amountInUsd).toFixed(2)} -> out ${quote.amountOutFormatted} USDC`, `cost ${cost === null ? "?" : cost.toFixed(0)} bps`, `eta ${quote.timeEstimate}s`);
    assert.ok(quote.depositAddress === undefined, "dry quote creates no deposit address");
  } catch (error) {
    console.log(chain.padEnd(5), symbol.padEnd(5), "quote failed:", (error as Error).message.slice(0, 120));
  }
}
console.log("intents checks passed");
