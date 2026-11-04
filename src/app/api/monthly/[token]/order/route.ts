import { z } from "zod";
import { fail, ok, today } from "@/lib/api/envelope";
import { attachOrder, monthlyView, needsForMonth, orderMonths, planFor } from "@/lib/monthly";
import { startRoutedGift } from "@/lib/paypal/gift-order";

const Body = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

/**
 * Create the PayPal order for one month of a monthly gift. The rules run again at this moment, on the needs as they
 * stand now, so the order matches what PayPal is about to pay even if someone else gave since the month was planned.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const started = Date.now();
  const { token } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request", "Send the month, like 2026-12.", 400);
  const v = await monthlyView(token, today());
  if (!v) return fail("not_found", "That monthly gift was not found.", 404);
  const run = v.runs.find((r) => r.month === parsed.data.month);
  if (!run) return fail("not_found", "That month is not planned yet.", 404);
  if (run.paid) return fail("invalid_request", "That month is already paid.", 409);

  const month = parsed.data.month;
  const paidFor = await orderMonths(v.household.id);
  const r = await startRoutedGift(v.household.slug, v.amount, {
    actor: "person",
    tag: `monthly:${month}`,
    plan: ({ needs, payments, profile, name }) => planFor(v.amount, needsForMonth(needs, payments, month, paidFor), month, profile, `${name}'s ABLE account`),
  });
  if (!r.ok) return fail(r.code, r.message, r.status, r.details);
  await attachOrder(token, month, r.orderId);
  return ok({ id: r.orderId, status: r.status, plan: r.plan }, started);
}
