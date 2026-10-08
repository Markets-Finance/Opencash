import type { Address, PublicClient } from "viem";
import { perplEventsAbi, accountByIdAbi } from "../perpl/events.js";

export type FetchOptions = {
  chunk?: number;
  delayMs?: number;
  concurrency?: number;
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
  const width = Math.max(1, options.concurrency ?? 1);
  const ranges: [bigint, bigint][] = [];
  for (let start = fromBlock; start <= toBlock; start += chunk) {
    ranges.push([start, start + chunk - 1n > toBlock ? toBlock : start + chunk - 1n]);
  }
  const logs: Awaited<ReturnType<typeof client.getLogs>> = [];
  let done = 0;
  for (let at = 0; at < ranges.length; at += width) {
    const parts = await Promise.all(
      ranges.slice(at, at + width).map(([start, end]) =>
        client.getLogs({ address: exchange, fromBlock: start, toBlock: end, events: perplEventsAbi as never }),
      ),
    );
    for (const part of parts) logs.push(...part);
    done += parts.length;
    options.onProgress?.(done, ranges.length);
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
