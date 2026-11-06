import { fail, ok } from "@/lib/api/envelope";
import { ManagePageRequest } from "@/lib/api/schemas";
import { dbConfigured } from "@/lib/db";
import { manageView, updatePage } from "@/lib/manage";
import { api } from "@/lib/api/handler";

type Ctx = { params: Promise<{ token: string }> };
const noDb = () => fail("upstream_unavailable", "Managing a page needs the database, which is not connected on this server.", 503);
const notFound = () => fail("not_found", "That manage link does not match any page.", 404);

/** GET /api/manage/{token}: the page, its needs and the gifts received, for the organizer. */
async function getRoute(_req: Request, { params }: Ctx) {
  const started = Date.now();
  if (!dbConfigured()) return noDb();
  const v = await manageView((await params).token);
  if (!v) return notFound();
  const { household: h } = v;
  return ok(
    {
      page: { name: h.name, slug: h.slug, url: `/g/${h.slug}`, status: h.status, note: h.note, webhook: h.webhookUrl ? { url: h.webhookUrl } : null },
      needs: v.needs.map((n) => ({
        id: n.id,
        title: n.title,
        detail: n.detail,
        category: n.category,
        route: n.route,
        paid_to: n.payeeName,
        amount: Number(n.amount),
        funded: Number(n.funded),
        status: n.status,
        rule: n.rule,
        removable: !n.hasPayments,
      })),
      gifts: v.payments.map((p) => ({ order_id: p.orderId, giver: p.payerName?.split(" ")[0] ?? null, paid_to: p.payeeName, amount: Number(p.amount), at: p.capturedAt })),
    },
    started,
  );
}

/** PATCH /api/manage/{token}: change the note, or close and reopen the page. */
async function patchRoute(req: Request, { params }: Ctx) {
  const started = Date.now();
  if (!dbConfigured()) return noDb();
  const parsed = ManagePageRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request", "Send a note of up to 400 characters, or a status of open or closed.", 400, parsed.error.issues);
  const row = await updatePage((await params).token, parsed.data);
  if (!row) return notFound();
  return ok({ status: row.status, note: row.note }, started);
}

export const GET = api("/api/manage/[token]", getRoute);
export const PATCH = api("/api/manage/[token]", patchRoute);
