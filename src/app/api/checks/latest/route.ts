import { connection } from "next/server";
import { ok } from "@/lib/api/envelope";
import { latestRun, workflowTask } from "@/lib/checks";
import { api } from "@/lib/api/handler";

/** GET /api/checks/latest: the most recent outside check, and whether a run can be started on Render Workflows here. */
async function getRoute() {
  await connection();
  const started = Date.now();
  return ok({ run: await latestRun(), can_start: Boolean(workflowTask()) }, started);
}

export const GET = api("/api/checks/latest", getRoute);
