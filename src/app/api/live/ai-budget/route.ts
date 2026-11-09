import { connection } from "next/server";
import { ok } from "@/lib/api/envelope";
import { api } from "@/lib/api/handler";
import { aiBudget } from "@/lib/ai/budget";

/**
 * GET /api/live/ai-budget: today's AI spend against the site's daily budget (from ai_usage), and how the next sample
 * run is answered: live, or Claude's recorded answer replayed through the same code. Shown beside each live step.
 */
async function getRoute() {
  await connection();
  const started = Date.now();
  return ok(await aiBudget(), started);
}

export const GET = api("/api/live/ai-budget", getRoute);
