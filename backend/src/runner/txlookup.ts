import { decodeEventLog, type Hash } from "viem";
import { perpl } from "shared";
import { contextFor, type Net } from "../analytics/context.js";

const chunk = 100n;
const positionEvents = new Set(["PositionOpenedV2", "PositionOpened", "PositionIncreased", "PositionDecreased", "PositionClosed", "PositionInverted"]);

export async function latestPositionTx(net: Net, accountId: bigint, fromBlock: bigint): Promise<Hash | undefined> {
  const { client, deployment } = contextFor(net);
  const head = await client.getBlockNumber();
  let found: Hash | undefined;
  for (let start = fromBlock; start <= head; start += chunk) {
    const end = start + chunk - 1n > head ? head : start + chunk - 1n;
    const logs = await client.getLogs({ address: deployment.exchange, fromBlock: start, toBlock: end });
    for (const log of logs) {
      try {
        const event = decodeEventLog({ abi: perpl.perplEventsAbi, data: log.data, topics: log.topics });
        const args = event.args as { accountId?: bigint };
        if (positionEvents.has(event.eventName) && args.accountId !== undefined && BigInt(args.accountId) === accountId && log.transactionHash) found = log.transactionHash;
      } catch {
        continue;
      }
    }
  }
  return found;
}
