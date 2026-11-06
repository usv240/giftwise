import { connection } from "next/server";
import { fail, ok } from "@/lib/api/envelope";
import { checksAuth } from "@/lib/checks";
import { dbConfigured } from "@/lib/db";
import { activeMonthlyIds } from "@/lib/monthly";
import { api } from "@/lib/api/handler";

/** GET /api/ops/monthly: the active monthly gifts' ids, for the Render Workflow. Only callers with CHECKS_SECRET. */
async function getRoute(req: Request) {
  await connection();
  const started = Date.now();
  const a = checksAuth(req);
  if (a === "unset") return fail("upstream_unavailable", "CHECKS_SECRET is not set on this server.", 503);
  if (a === "bad") return fail("unauthorized", "Only the Giftwise workflow can do this.", 401);
  if (!dbConfigured()) return fail("upstream_unavailable", "This needs the database.", 503);
  return ok({ ids: await activeMonthlyIds() }, started);
}

export const GET = api("/api/ops/monthly", getRoute);
