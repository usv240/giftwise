import { createHash, timingSafeEqual } from "node:crypto";
import { redactDeep } from "./scrub";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { db, dbConfigured, schema } from "./db";

/**
 * The outside checks. A Render Workflow (workflows/ in this repo) runs every failure case, every step of the product's
 * path and the public API from outside the app, each as its own task with retries, and files the results here.
 */

/** Calls from the workflow carry CHECKS_SECRET, which Render shares between the services in render.yaml. */
export function checksAuth(req: Request): "ok" | "unset" | "bad" {
  const secret = process.env.CHECKS_SECRET;
  if (!secret) return "unset";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(got), hash(secret)) ? "ok" : "bad";
}

export const CheckResult = z.object({
  id: z.string().min(1).max(60),
  group: z.enum(["case", "path", "api"]),
  title: z.string().min(1).max(200),
  ok: z.boolean(),
  detail: z.string().max(600),
  ms: z.number().int().min(0).max(3_600_000),
  attempts: z.number().int().min(1).max(10).default(1),
});
export type CheckResult = z.infer<typeof CheckResult>;

export const CheckRunBody = z.object({
  source: z.enum(["render-workflow", "local"]),
  runId: z.string().max(120).default(""),
  appUrl: z.string().url().max(200),
  startedAt: z.string().datetime(),
  results: z.array(CheckResult).min(1).max(80),
});

export type CheckRun = { id: number; source: string; runId: string; appUrl: string; passed: number; total: number; results: CheckResult[]; startedAt: string; finishedAt: string; ageMinutes: number };

export async function saveRun(b: z.infer<typeof CheckRunBody>) {
  const passed = b.results.filter((r) => r.ok).length;
  const [row] = await db()
    .insert(schema.checkRuns)
    // Results are shown on /evidence and /status: no credential-shaped text is stored, whatever a check reported.
    .values({ source: b.source, runId: b.runId, appUrl: b.appUrl, passed, total: b.results.length, results: redactDeep(b.results), startedAt: new Date(b.startedAt) })
    .returning();
  return row;
}

export async function latestRun(): Promise<CheckRun | null> {
  if (!dbConfigured()) return null;
  const [r] = await db().select().from(schema.checkRuns).orderBy(desc(schema.checkRuns.finishedAt)).limit(1);
  if (!r) return null;
  return { id: r.id, source: r.source, runId: r.runId, appUrl: r.appUrl, passed: r.passed, total: r.total, results: redactDeep(r.results as CheckResult[]), startedAt: r.startedAt.toISOString(), finishedAt: r.finishedAt.toISOString(), ageMinutes: Math.max(0, Math.round((Date.now() - r.finishedAt.getTime()) / 60_000)) };
}

/** The workflow's task slug, from render.yaml (the workflow service's slug plus the task name). */
export function workflowTask() {
  const slug = process.env.CHECKS_WORKFLOW_SLUG;
  return slug && process.env.RENDER_API_KEY ? `${slug}/nightlyCheck` : null;
}
