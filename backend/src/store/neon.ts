import { neon } from "@neondatabase/serverless";

export const databaseUrl = process.env.DATABASE_URL;

export function sql() {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  return neon(databaseUrl);
}

type Tagged = { owner?: string; net?: string };

export class NeonStore<T> {
  constructor(private readonly collection: string) {}

  async get(id: string): Promise<T | undefined> {
    const rows = await sql()`select data from documents where collection = ${this.collection} and id = ${id}`;
    return rows[0]?.data as T | undefined;
  }

  async all(): Promise<T[]> {
    const rows = await sql()`select data from documents where collection = ${this.collection}`;
    return rows.map((row) => row.data as T);
  }

  async set(id: string, value: T): Promise<void> {
    const { owner = null, net = null } = value as Tagged;
    await sql()`insert into documents (collection, id, owner, net, data) values (${this.collection}, ${id}, ${owner}, ${net}, ${JSON.stringify(value)}::jsonb)
      on conflict (collection, id) do update set owner = excluded.owner, net = excluded.net, data = excluded.data, updated_at = now()`;
  }

  async delete(id: string): Promise<void> {
    await sql()`delete from documents where collection = ${this.collection} and id = ${id}`;
  }
}
