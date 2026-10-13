type Entry = { value: unknown; at: number };

const entries = new Map<string, Entry>();

export function peek<T>(key: string): T | null {
  const entry = entries.get(key);
  return entry === undefined ? null : (entry.value as T);
}

export function remember<T>(key: string, value: T): T {
  entries.set(key, { value, at: Date.now() });
  return value;
}

export function isFresh(key: string, ms: number): boolean {
  const entry = entries.get(key);
  return entry !== undefined && Date.now() - entry.at < ms;
}

export function forgetAll(): void {
  entries.clear();
}

export function invalidate(): void {
  for (const key of [...entries.keys()]) if (key !== "markets") entries.delete(key);
}
