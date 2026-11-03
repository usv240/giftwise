import { Render } from "@renderinc/sdk";
import { connection } from "next/server";
import { fail, ok } from "@/lib/api/envelope";
import { audit } from "@/lib/audit";
import { workflowTask } from "@/lib/checks";

let lastStart = 0;
const COOLDOWN_MS = 10 * 60_000;

/**
 * POST /api/checks/start: start the outside checks on Render Workflows now. The workflow fans out one task per check,
 * each on its own instance with retries, and files the results with POST /api/checks when it finishes.
 */
export async function POST() {
  await connection();
  const started = Date.now();
  const slug = workflowTask();
  if (!slug) return fail("upstream_unavailable", "Starting the checks needs the Render Workflows service, which runs on the hosted demo. The latest nightly run is shown below.", 503);
  const wait = lastStart + COOLDOWN_MS - started;
  if (wait > 0) return fail("rate_limited", `A run started ${Math.round((started - lastStart) / 60_000)} minutes ago. The next one can start in ${Math.ceil(wait / 60_000)} minutes.`, 429);
  lastStart = started;
  try {
    const run = await new Render().workflows.startTask(slug, [{ trigger: "judges-page" }]);
    await audit("system", "checks.started", `render-task-run:${run.taskRunId}`, { trigger: "judges-page" });
    return ok({ task_run_id: run.taskRunId }, started);
  } catch (e) {
    lastStart = 0;
    return fail("upstream_unavailable", `Render Workflows did not start the run: ${(e as Error).message.slice(0, 160)}`, 502);
  }
}
