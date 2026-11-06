import { connection } from "next/server";
import { fail, ok } from "@/lib/api/envelope";
import { checksAuth } from "@/lib/checks";
import { dbConfigured } from "@/lib/db";
import { CASES } from "@/lib/cases/list";
import { runScenario } from "@/lib/cases/scenarios";
import { paypalConfigured } from "@/lib/paypal/client";

/** GET /api/checks/case/{any}: the failure cases the workflow fans out over. Public: titles only. */
export async function GET() {
  return Response.json({ data: CASES.map((c) => ({ id: c.id, title: c.title })), error: null });
}

/** POST /api/checks/case/{id}: run one failure case live against the PayPal sandbox. Only the checks workflow may call it. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const started = Date.now();
  const auth = checksAuth(req);
  if (auth === "unset") return fail("upstream_unavailable", "CHECKS_SECRET is not set on this server.", 503);
  if (auth === "bad") return fail("unauthorized", "Only the Giftwise checks workflow can run single cases.", 401);
  if (!paypalConfigured() || !dbConfigured()) return fail("upstream_unavailable", "The failure cases need PayPal sandbox keys and the database.", 503);
  const { id } = await params;
  const r = await runScenario(id);
  if (!r) return fail("not_found", "There is no failure case with that id.", 404);
  return ok(r, started);
}
