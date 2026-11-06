import { sql } from "drizzle-orm";
import { db, dbConfigured } from "./db";
import { log } from "./log";

/**
 * Rate limits that hold across instances and deploys: one Postgres row per (bucket, window), bumped by a single
 * upsert that returns the new count. A bucket is any string: "agent-demo", "checks:start", "studio:<client>".
 * Windows are fixed (aligned to the window length), so one query decides and no clock drifts between servers.
 */

export type Hit = { allowed: boolean; count: number; remaining: number; windowStart: Date; retryAfterSec: number };

/** The decision from a count, kept pure so it can be tested without a database. */
export function decide(count: number, limit: number, windowStart: Date, windowSec: number, now = Date.now()): Hit {
  const ends = windowStart.getTime() + windowSec * 1000;
  return { allowed: count <= limit, count, remaining: Math.max(0, limit - count), windowStart, retryAfterSec: Math.max(1, Math.ceil((ends - now) / 1000)) };
}

type Row = { count: number; window_start: Date | string };

/** Count one hit in the bucket's current window and say whether it is within the limit. */
export async function hit(bucket: string, windowSec: number, limit: number): Promise<Hit> {
  if (!dbConfigured()) return decide(1, limit, new Date(), windowSec);
  const r = await db().execute(sql`
    insert into rate_limit (bucket, window_start, count)
    values (${bucket}, to_timestamp(floor(extract(epoch from now()) / ${windowSec}) * ${windowSec}), 1)
    on conflict (bucket, window_start) do update set count = rate_limit.count + 1
    returning count, window_start`);
  const row = rowsOf<Row>(r)[0];
  void pruneEvery();
  return decide(Number(row.count), limit, new Date(row.window_start), windowSec);
}

/** Forget the bucket's current window, for a call that was counted but did not happen (an upstream that refused to start). */
export async function release(bucket: string, windowSec: number) {
  if (!dbConfigured()) return;
  await db().execute(sql`delete from rate_limit where bucket = ${bucket} and window_start = to_timestamp(floor(extract(epoch from now()) / ${windowSec}) * ${windowSec})`);
}

export function rowsOf<T>(r: unknown): T[] {
  if (Array.isArray(r)) return r as T[];
  return ((r as { rows?: T[] }).rows ?? []) as T[];
}

const PRUNE_EVERY = 50;
let calls = 0;
/** Every N hits, drop windows older than a day and request log lines older than seven days. Cheap, and no cron to run. */
export async function pruneEvery() {
  calls++;
  if (calls % PRUNE_EVERY !== 0 || !dbConfigured()) return;
  await prune().catch((err) => log.warn("prune failed", { err }));
}

export async function prune() {
  await db().execute(sql`delete from rate_limit where window_start < now() - interval '1 day'`);
  await db().execute(sql`delete from request_log where created_at < now() - interval '7 days'`);
  await db().execute(sql`delete from ai_usage where created_at < now() - interval '30 days'`);
}
