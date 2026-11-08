import { Render } from "@renderinc/sdk";
import { connection } from "next/server";
import { fail, ok } from "@/lib/api/envelope";
import { audit } from "@/lib/audit";
import { workflowTask } from "@/lib/checks";
import { api } from "@/lib/api/handler";
import { log } from "@/lib/log";
import { failureKind } from "@/lib/scrub";
import { hit, release } from "@/lib/rate-limit";

const COOLDOWN_SEC = 10 * 60;

/**
 * POST /api/checks/start: start the outside checks on Render Workflows now. The workflow fans out one task per check,
 * each on its own instance with retries, and files the results with POST /api/checks when it finishes.
 */
async function postRoute() {
  await connection();
  const started = Date.now();
  const slug = workflowTask();
  if (!slug) return fail("upstream_unavailable", "Starting the checks needs the Render Workflows service, which runs on the hosted demo. The latest nightly run is shown below.", 503);
  // One start per ten-minute window, counted in Postgres so every instance sees the same cooldown.
  const h = await hit("checks:start", COOLDOWN_SEC, 1);
  if (!h.allowed) {
    const ago = Math.round((started - h.windowStart.getTime()) / 60_000);
    return fail("rate_limited", `A run started ${ago} minutes ago. The next one can start in ${Math.ceil(h.retryAfterSec / 60)} minutes.`, 429);
  }
  try {
    const run = await new Render().workflows.startTask(slug, [{ trigger: "evidence-page" }]);
    await audit("system", "checks.started", `render-task-run:${run.taskRunId}`, { trigger: "evidence-page" });
    log.info("checks started", { taskRunId: run.taskRunId });
    return ok({ task_run_id: run.taskRunId }, started);
  } catch (e) {
    await release("checks:start", COOLDOWN_SEC);
    log.warn("checks did not start", { err: e });
    return fail("upstream_unavailable", `Render Workflows did not start the run (${failureKind(e)}).`, 502);
  }
}

export const POST = api("/api/checks/start", postRoute);
