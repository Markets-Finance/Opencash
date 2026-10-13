import { agentMemoryNamespace, loadVault, saveVault, type NamespaceSession, type StrategyCard } from "shared";
import { openNamespace } from "../../mera";
import { requireTrader } from "../state";

export type ChatEntry = { role: "me" | "bot"; text: string; checked?: string[] };
export type Memory = { messages: ChatEntry[]; card: StrategyCard | null };

const backend = import.meta.env.PUBLIC_BACKEND_URL ?? "http://localhost:8787";
const keep = 40;

let session: NamespaceSession | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

export const memoryUnlocked = () => session !== null;

export async function unlockMemory(): Promise<Memory> {
  session ??= await openNamespace(agentMemoryNamespace);
  const saved = await loadVault(backend, requireTrader(), agentMemoryNamespace, session);
  if (saved === null) return { messages: [], card: null };
  try {
    const parsed = JSON.parse(saved) as Memory;
    return { messages: Array.isArray(parsed.messages) ? parsed.messages.slice(-keep) : [], card: parsed.card ?? null };
  } catch {
    return { messages: [], card: null };
  }
}

export function rememberSoon(memory: Memory) {
  if (!session) return;
  clearTimeout(timer);
  const current = session;
  timer = setTimeout(() => {
    void saveVault(backend, requireTrader(), agentMemoryNamespace, JSON.stringify({ messages: memory.messages.slice(-keep), card: memory.card }), current).catch(() => {});
  }, 1500);
}
