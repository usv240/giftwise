import { fail, ok } from "@/lib/api/envelope";
import { ManageNeedRequest } from "@/lib/api/schemas";
import { dbConfigured } from "@/lib/db";
import { addNeed } from "@/lib/manage";
import { api } from "@/lib/api/handler";

/** POST /api/manage/{token}/needs: add a need. The rules engine picks the route; housing goes to the ABLE account. */
async function postRoute(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const started = Date.now();
  if (!dbConfigured()) return fail("upstream_unavailable", "Managing a page needs the database, which is not connected on this server.", 503);
  const parsed = ManageNeedRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request", "Add what the need is for, an amount from $1 to $20,000 and a category.", 400, parsed.error.issues);
  const row = await addNeed((await params).token, parsed.data);
  if (!row) return fail("not_found", "That manage link does not match any page.", 404);
  if ("error" in row) return fail("invalid_request", String(row.error), 400);
  return ok({ id: row.id, route: row.route, paid_to: row.payeeName }, started);
}

export const POST = api("/api/manage/[token]/needs", postRoute);
