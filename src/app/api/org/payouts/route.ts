import { and, count, eq, gte, sum } from "drizzle-orm";
import { z } from "zod";
import { fail, ok } from "@/lib/api/envelope";
import { clientId } from "@/lib/api/keys";
import { db, dbConfigured, schema } from "@/lib/db";
import { paypalConfigured } from "@/lib/paypal/client";
import { LIMITS, planGrants, sendBatch } from "@/lib/paypal/payouts";
import { fundBalance } from "@/lib/paypal/reporting";

const Body = z.object({
  grants: z
    .array(z.object({ slug: z.string().min(1).max(60), amount: z.number().min(1).max(LIMITS.perHousehold) }))
    .min(1)
    .max(LIMITS.households),
  preview: z.boolean().optional(),
});

/**
 * POST /api/org/payouts: route each household's grant with the rules engine and send one PayPal Payouts batch.
 * With preview: true, only the routing comes back. Sandbox caps keep the fund's balance usable through judging.
 */
export async function POST(req: Request) {
  const started = Date.now();
  if (!dbConfigured() || !paypalConfigured()) return fail("upstream_unavailable", "Payouts need PayPal and the database, which are not connected on this server.", 503);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request", `Choose up to ${LIMITS.households} households and up to $${LIMITS.perHousehold} each.`, 400, parsed.error.issues);
  const total = parsed.data.grants.reduce((s, g) => s + g.amount, 0);
  if (total > LIMITS.perBatch) return fail("invalid_request", `One batch can send up to $${LIMITS.perBatch} in the sandbox.`, 400);
  if (new Set(parsed.data.grants.map((g) => g.slug)).size !== parsed.data.grants.length) return fail("invalid_request", "Each household can appear once in a batch.", 400);

  const plan = await planGrants(parsed.data.grants);
  if ("error" in plan) return fail("invalid_request", plan.error!, 422);
  if (parsed.data.preview) return ok({ preview: true, households: plan.households, items: plan.items }, started);

  const client = `org:${clientId(req)}`;
  const since = new Date(Date.now() - 86400_000);
  const [mine] = await db().select({ n: count() }).from(schema.apiRequests).where(and(eq(schema.apiRequests.client, client), eq(schema.apiRequests.endpoint, "org-payouts"), gte(schema.apiRequests.at, since)));
  if ((mine?.n ?? 0) >= LIMITS.batchesPerVisitorPerDay) return fail("rate_limited", "That is the limit of sandbox payout batches for today. Earlier batches still show below.", 429);
  const [today] = await db().select({ total: sum(schema.payouts.amount) }).from(schema.payouts).where(gte(schema.payouts.createdAt, since));
  if (Number(today?.total ?? 0) + total > LIMITS.totalPerDay) return fail("rate_limited", "The sample fund has sent its sandbox limit for today. Earlier batches still show below.", 429);

  const sent = await sendBatch(plan.items);
  await db().insert(schema.apiRequests).values({ keyId: null, client, endpoint: "org-payouts", status: sent.ok ? 200 : 502, ms: Date.now() - started });
  if (!sent.ok) return fail("upstream_unavailable", sent.message, 502, { issue: sent.issue, debug_id: sent.debugId });
  return ok({ batch_id: sent.batchId, status: sent.status, households: plan.households, items: plan.items, balance: await fundBalance() }, started);
}
