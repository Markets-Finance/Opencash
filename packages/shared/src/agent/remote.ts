import type { StrategyCard } from "../strategy/types.js";

export type AgentDraft = { card: StrategyCard | null; reply: string; checked: string[] };

export async function askAgent(backend: string, owner: string, network: string, prompt: string): Promise<AgentDraft | null> {
  try {
    const response = await fetch(`${backend}/agent/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, owner, network }),
    });
    if (!response.ok) return null;
    return (await response.json()) as AgentDraft;
  } catch {
    return null;
  }
}
