import { connection } from "next/server";
import { ok } from "@/lib/api/envelope";
import { latestRun, workflowTask } from "@/lib/checks";

/** GET /api/checks/latest: the most recent outside check, and whether a run can be started on Render Workflows here. */
export async function GET() {
  await connection();
  const started = Date.now();
  return ok({ run: await latestRun(), can_start: Boolean(workflowTask()) }, started);
}
