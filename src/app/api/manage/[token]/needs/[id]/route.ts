import { fail, ok } from "@/lib/api/envelope";
import { ManageNeedRequest } from "@/lib/api/schemas";
import { dbConfigured } from "@/lib/db";
import { editNeed, removeNeed } from "@/lib/manage";
import { api } from "@/lib/api/handler";

type Ctx = { params: Promise<{ token: string; id: string }> };
const noDb = () => fail("upstream_unavailable", "Managing a page needs the database, which is not connected on this server.", 503);
const notFound = () => fail("not_found", "That need is not on this page.", 404);

/** PATCH /api/manage/{token}/needs/{id}: edit a need; the rules engine picks its route again. */
async function patchRoute(req: Request, { params }: Ctx) {
  const started = Date.now();
  if (!dbConfigured()) return noDb();
  const { token, id } = await params;
  const parsed = ManageNeedRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request", "Add what the need is for, an amount from $1 to $20,000 and a category.", 400, parsed.error.issues);
  const row = await editNeed(token, Number(id), parsed.data);
  if (!row) return notFound();
  if ("error" in row) return fail("invalid_request", String(row.error), 409);
  return ok({ id: row.id, route: row.route, paid_to: row.payeeName, status: row.status }, started);
}

/** DELETE /api/manage/{token}/needs/{id}: remove a need nobody has paid toward. */
async function deleteRoute(_req: Request, { params }: Ctx) {
  const started = Date.now();
  if (!dbConfigured()) return noDb();
  const { token, id } = await params;
  const r = await removeNeed(token, Number(id));
  if (!r) return notFound();
  if ("error" in r) return fail("invalid_request", String(r.error), 409);
  return ok({ removed: Number(id) }, started);
}

export const PATCH = api("/api/manage/[token]/needs/[id]", patchRoute);
export const DELETE = api("/api/manage/[token]/needs/[id]", deleteRoute);
