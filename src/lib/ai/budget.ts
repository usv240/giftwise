import { sql } from "drizzle-orm";
import { db, dbConfigured } from "../db";
import { rowsOf } from "../rate-limit";
import { AI_DAILY_CAP_USD, aiMode, type AiMode } from "./claude";

/** What the site's AI calls cost today, in US Pacific time, from the ai_usage table /ops reads. */
export async function aiSpentToday(): Promise<number> {
  if (!dbConfigured()) return 0;
  const r = await db().execute(sql`select coalesce(sum(cost_usd), 0) as cost from ai_usage where created_at >= (date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles')`);
  return Number(rowsOf<{ cost: string }>(r)[0]?.cost ?? 0);
}

/**
 * The day's AI budget as a visitor sees it beside a live step: what is left, and how the next sample run is answered.
 * live: a key, and today's spend under the cap. replayed: Claude's recorded answer, run through the same code, because
 * there is no key or the day's budget is spent. saved: no key and no recordings, so the saved examples are shown.
 */
export type AiBudget = { mode: AiMode; spent_today: number; cap: number; left: number; next: "live" | "replayed" | "saved"; why: "no_key" | "budget" | null };

export async function aiBudget(): Promise<AiBudget> {
  const [mode, spent] = await Promise.all([aiMode(), aiSpentToday().catch(() => 0)]);
  const cap = AI_DAILY_CAP_USD;
  const left = Math.max(0, Math.round((cap - spent) * 100) / 100);
  const over = spent >= cap;
  const next = mode === "live" ? (over ? "replayed" : "live") : mode === "replay" ? "replayed" : "saved";
  const why = next === "live" ? null : mode === "live" ? "budget" : "no_key";
  return { mode, spent_today: Math.round(spent * 10000) / 10000, cap, left, next, why };
}
