import type { templates } from "shared";
import type { Net } from "../analytics/context.js";
import { JsonFileStore } from "../store/jsonFile.js";

export type ServerLiveBot = templates.LiveBot & {
  owner: string;
  net: Net;
  mandate: { digest: string; signature: string; issuedAt: number };
};

const store = new JsonFileStore<ServerLiveBot>("data/live-bots.json");
const locks = new Map<string, Promise<unknown>>();

export async function listLive(filter: { owner?: string; net?: Net; enabled?: boolean } = {}): Promise<ServerLiveBot[]> {
  return (await store.all()).filter(
    (bot) =>
      (filter.owner === undefined || bot.owner.toLowerCase() === filter.owner.toLowerCase()) &&
      (filter.net === undefined || bot.net === filter.net) &&
      (filter.enabled === undefined || bot.enabled === filter.enabled),
  );
}

export async function getLive(id: string): Promise<ServerLiveBot | null> {
  return (await store.get(id)) ?? null;
}

export function saveLive(bot: ServerLiveBot): Promise<void> {
  return store.set(bot.id, bot);
}

export function deleteLive(id: string): Promise<void> {
  return store.delete(id);
}

export function withLiveLock<T>(id: string, run: () => Promise<T>): Promise<T> {
  const previous = locks.get(id) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(run);
  locks.set(id, next);
  void next
    .finally(() => {
      if (locks.get(id) === next) locks.delete(id);
    })
    .catch(() => undefined);
  return next;
}
