import { today, fail, ok } from "@/lib/api/envelope";
import { findGifts } from "@/lib/channel3";
import { dbConfigured } from "@/lib/db";
import { householdByToken } from "@/lib/manage";
import { DEFAULT_PROFILE, type Profile } from "@/lib/rules";
import { api } from "@/lib/api/handler";

/**
 * GET /api/manage/{token}/find?q=wheelchair+cushion&max=200: real products from Channel3 (or the sample catalog),
 * each checked against the SSI rules for this page's person before it can be added.
 */
async function getRoute(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const started = Date.now();
  if (!dbConfigured()) return fail("upstream_unavailable", "Managing a page needs the database, which is not connected on this server.", 503);
  const h = await householdByToken((await params).token);
  if (!h) return fail("not_found", "That manage link does not match any page.", 404);
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 120) return fail("invalid_request", "Search for what the need is, in a few words.", 400);
  const max = Number(u.searchParams.get("max"));
  const profile: Profile = { ...DEFAULT_PROFILE, ...(h.profile as Partial<Profile>) };
  const r = await findGifts(q, profile, today(), { maxPrice: max > 0 && max <= 20000 ? max : undefined, user: h.slug });
  return ok(r, started);
}

export const GET = api("/api/manage/[token]/find", getRoute);
