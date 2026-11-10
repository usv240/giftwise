import { fail, ok } from "@/lib/api/envelope";
import { ManagePageRequest, givenProfileKeys } from "@/lib/api/schemas";
import { dbConfigured } from "@/lib/db";
import { manageView, updatePage } from "@/lib/manage";
import { checkFor, householdProfile, householdSituation, type ProfileKey } from "@/lib/situation";
import { today } from "@/lib/time";
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
  const now = checkFor(v.profile, today().slice(0, 7));
  return ok(
    {
      page: { name: h.name, slug: h.slug, url: `/g/${h.slug}`, status: h.status, note: h.note, webhook: h.webhookUrl ? { url: h.webhookUrl } : null },
      // Whose facts the page runs on, the facts themselves, and her check with no gift for a gift made today.
      situation: situationOf(h),
      profile: v.profile,
      check: { amount: now.check, payment_month: now.paymentMonth },
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

/** "own" with where the facts came from, or "sample" while the page uses the sample situation. */
function situationOf(h: { profile: unknown; isSample: boolean }) {
  const meta = householdSituation(h.profile);
  return { kind: h.isSample ? "sample_page" : meta ? "own" : "sample", source: meta?.source ?? null, saved_at: meta?.saved_at || null, given: meta?.given ?? [] };
}

/** PATCH /api/manage/{token}: change the note, close and reopen the page, or set the person's situation. */
async function patchRoute(req: Request, { params }: Ctx) {
  const started = Date.now();
  if (!dbConfigured()) return noDb();
  const body = await req.json().catch(() => null);
  const parsed = ManagePageRequest.safeParse(body);
  if (!parsed.success) return fail("invalid_request", "Send a note of up to 400 characters, a status of open or closed, or the person's situation as a profile.", 400, parsed.error.issues);
  const { profile, profile_source, ...rest } = parsed.data;
  // Only the fields sent count as the person's own facts; null puts the page back on the sample situation.
  const situation = profile === undefined ? undefined : profile === null ? null : { profile, given: givenProfileKeys(body) as ProfileKey[], source: profile_source ?? ("api" as const) };
  const row = await updatePage((await params).token, { ...rest, situation });
  if (!row) return notFound();
  const p = householdProfile(row.profile);
  const now = checkFor(p, today().slice(0, 7));
  return ok({ status: row.status, note: row.note, situation: situationOf(row), profile: p, check: { amount: now.check, payment_month: now.paymentMonth } }, started);
}

export const GET = api("/api/manage/[token]", getRoute);
export const PATCH = api("/api/manage/[token]", patchRoute);
