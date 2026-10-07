import type { Address, PublicClient } from "viem";
import { perplEventsAbi, accountByIdAbi } from "../perpl/events.js";

export type FetchOptions = {
  chunk?: number;
  delayMs?: number;
  onProgress?: (done: number, total: number) => void;
};

const defaultChunk = 100;
const defaultDelayMs = 90;

export async function fetchLedgerLogs(
  client: PublicClient,
  exchange: Address,
  fromBlock: bigint,
  toBlock: bigint,
  options: FetchOptions = {},
) {
  const chunk = BigInt(options.chunk ?? defaultChunk);
  const total = Number((toBlock - fromBlock) / chunk) + 1;
  const logs: Awaited<ReturnType<typeof client.getLogs>> = [];
  let done = 0;
  for (let start = fromBlock; start <= toBlock; start += chunk) {
    const end = start + chunk - 1n > toBlock ? toBlock : start + chunk - 1n;
    const part = await client.getLogs({
      address: exchange,
      fromBlock: start,
      toBlock: end,
      events: perplEventsAbi as never,
    });
    logs.push(...part);
    done += 1;
    options.onProgress?.(done, total);
    await new Promise((resolve) => setTimeout(resolve, options.delayMs ?? defaultDelayMs));
  }
  return logs;
}

export async function resolveAddresses(
  client: PublicClient,
  exchange: Address,
  accountIds: number[],
): Promise<Map<number, Address>> {
  const out = new Map<number, Address>();
  await Promise.all(
    accountIds.map(async (id) => {
      try {
        const info = (await client.readContract({
          address: exchange,
          abi: accountByIdAbi,
          functionName: "getAccountById",
          args: [BigInt(id)],
        })) as { accountAddr: Address };
        out.set(id, info.accountAddr);
      } catch {
        return;
      }
    }),
  );
  return out;
}
