import { readFile } from "node:fs/promises";
import { Pool } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const pool = new Pool({ connectionString: url });
await pool.query(await readFile(new URL("./schema.sql", import.meta.url), "utf8"));
await pool.end();
console.log("schema applied");
