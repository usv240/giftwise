import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  var __giftwisePool: Pool | undefined;
}

export function dbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function pool() {
  // One pool per server process, reused across hot reloads in development. Ten connections: every API request now
  // makes two or three short queries (the rate limit, the usage row, the request log), and a hundred visitors at once
  // queue behind five. Render's 256 MB Postgres allows about 97, so one instance at ten leaves room for the workflow.
  globalThis.__giftwisePool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.PG_POOL_MAX) || 10,
    ssl: process.env.DATABASE_URL?.includes("render.com") ? { rejectUnauthorized: false } : undefined,
  });
  return globalThis.__giftwisePool;
}

export const db = () => drizzle(pool(), { schema });
export { schema };
