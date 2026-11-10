import { and, count, eq, gte } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/envelope";
import { clientId, guard } from "@/lib/api/keys";
import { GiftPageRequest, givenProfileKeys } from "@/lib/api/schemas";
import { db, dbConfigured, schema } from "@/lib/db";
import { createGiftPage } from "@/lib/households";
import type { ProfileKey } from "@/lib/situation";
import { api } from "@/lib/api/handler";

const PER_DAY = 5;

/** POST /api/v1/gift-pages: create a sandbox gift page from a list of needs. */
async function handle(req: Request) {
  const started = Date.now();
  if (!dbConfigured()) return fail("upstream_unavailable", "Gift pages need the database, which is not connected on this server.", 503);
  const body = await req.json().catch(() => null);
  const parsed = GiftPageRequest.safeParse(body);
  if (!parsed.success) return fail("invalid_request", "Add a first name, pronouns and at least one need with an amount.", 400, parsed.error.issues);

  const since = new Date(Date.now() - 86400_000);
  const [made] = await db()
    .select({ n: count() })
    .from(schema.apiRequests)
    .where(and(eq(schema.apiRequests.endpoint, "gift-pages"), eq(schema.apiRequests.client, clientId(req)), eq(schema.apiRequests.status, 200), gte(schema.apiRequests.at, since)));
  if ((made?.n ?? 0) >= PER_DAY) return fail("rate_limited", "That is the limit of new gift pages for today. The pages you made still work.", 429);

  const b = parsed.data;
  // Only the facts the caller sent count as the person's own; the schema fills the others with the sample situation's.
  const given = givenProfileKeys(body) as ProfileKey[];
  const situation = b.profile && given.length ? { profile: b.profile, given, source: b.profile_source ?? ("api" as const) } : undefined;
  const page = await createGiftPage({ name: b.name, pronoun: b.pronoun, organizer: b.organizer, note: b.note, sourceUrl: b.source_url, needs: b.needs, situation });
  // The ledger notes how the facts were gathered and how many were given, never the amounts.
  await audit("person", "gift_page.created", `household:${page.household.id}`, { slug: page.slug, needs: page.needs.length, source: b.source_url ?? null, situation: situation ? situation.source : "sample", fields: given.length });
  // The manage link is the organizer's private key to the page: shown once here, stored only as a hash.
  return ok(
    { slug: page.slug, url: `/g/${page.slug}`, manage_url: `/manage/${page.manageToken}`, situation: page.situation, profile: page.profile, check: page.check, needs: page.needs },
    started,
  );
}

const postRoute = (req: Request) => guard(req, "gift-pages", () => handle(req));

export const POST = api("/api/v1/gift-pages", postRoute);
