import { connection } from "next/server";
import { fail, ok } from "@/lib/api/envelope";
import { checksAuth } from "@/lib/checks";
import { dbConfigured } from "@/lib/db";
import { z } from "zod";
import { planMonthById } from "@/lib/monthly";

const Body = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

/** POST /api/ops/monthly/{id}/plan: plan one monthly gift's month ahead of time. Only callers with CHECKS_SECRET. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const started = Date.now();
  const a = checksAuth(req);
  if (a === "unset") return fail("upstream_unavailable", "CHECKS_SECRET is not set on this server.", 503);
  if (a === "bad") return fail("unauthorized", "Only the Giftwise workflow can do this.", 401);
  if (!dbConfigured()) return fail("upstream_unavailable", "This needs the database.", 503);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request", "Send the month as YYYY-MM.", 400);
  const r = await planMonthById(Number((await params).id), parsed.data.month);
  if (!r) return fail("not_found", "No monthly gift with that id.", 404);
  return ok(r, started);
}
