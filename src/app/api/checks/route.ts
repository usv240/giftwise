import { connection } from "next/server";
import { fail, ok } from "@/lib/api/envelope";
import { audit } from "@/lib/audit";
import { CheckRunBody, checksAuth, saveRun } from "@/lib/checks";
import { dbConfigured } from "@/lib/db";

/** POST /api/checks: the checks workflow files one finished run. Only callers with CHECKS_SECRET. */
export async function POST(req: Request) {
  await connection();
  const started = Date.now();
  const auth = checksAuth(req);
  if (auth === "unset") return fail("upstream_unavailable", "CHECKS_SECRET is not set on this server.", 503);
  if (auth === "bad") return fail("unauthorized", "Only the Giftwise checks workflow can file results.", 401);
  if (!dbConfigured()) return fail("upstream_unavailable", "Saving a run needs the database.", 503);
  const parsed = CheckRunBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request", "The run is missing fields or has fields that are not valid. See details.", 400, parsed.error.issues);
  const row = await saveRun(parsed.data);
  await audit("system", "checks.run", `checks:${row.id}`, { source: row.source, runId: row.runId, passed: row.passed, total: row.total });
  return ok({ id: row.id, passed: row.passed, total: row.total }, started);
}
