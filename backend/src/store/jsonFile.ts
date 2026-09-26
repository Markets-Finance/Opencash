import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// MVP persistence: a JSON file per collection. Fine for a hackathon single
// instance; not safe for concurrent writers or production scale.
export class JsonFileStore<T> {
  private cache: Map<string, T> | null = null;

  constructor(private readonly path: string) {}

  private async load(): Promise<Map<string, T>> {
    if (this.cache) return this.cache;
    try {
      const raw = await readFile(this.path, "utf8");
      const entries = JSON.parse(raw) as [string, T][];
      this.cache = new Map(entries);
    } catch {
      this.cache = new Map();
    }
    return this.cache;
  }

  private async persist(): Promise<void> {
    if (!this.cache) return;
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify([...this.cache.entries()], null, 2));
  }

  async get(id: string): Promise<T | undefined> {
    const map = await this.load();
    return map.get(id);
  }

  async all(): Promise<T[]> {
    const map = await this.load();
    return [...map.values()];
  }

  async set(id: string, value: T): Promise<void> {
    const map = await this.load();
    map.set(id, value);
    await this.persist();
  }
}
