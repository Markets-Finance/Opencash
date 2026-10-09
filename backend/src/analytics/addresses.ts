import type { Address } from "viem";
import { resolveAddresses } from "shared";
import { contextFor, type Net } from "./context.js";
import { storeFor } from "./store.js";

const known = new Map<string, Address>();

export async function addressBook(net: Net, ids: number[]): Promise<Map<number, Address>> {
  const saved = await storeFor(net).snapshot();
  const book = new Map<number, Address>();
  for (const event of saved.events) if (event.kind === "account") book.set(event.accountId, event.address);
  const missing: number[] = [];
  for (const id of ids) {
    const cached = known.get(`${net}:${id}`);
    if (cached) book.set(id, cached);
    else if (!book.has(id)) missing.push(id);
  }
  if (missing.length > 0) {
    const { client, deployment } = contextFor(net);
    const resolved = await resolveAddresses(client, deployment.exchange, missing);
    for (const [id, address] of resolved) {
      known.set(`${net}:${id}`, address);
      book.set(id, address);
    }
  }
  return book;
}
