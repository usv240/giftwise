import { z } from "zod";
import { fail, ok, today } from "@/lib/api/envelope";
import { audit } from "@/lib/audit";
import { db, schema } from "@/lib/db";
import { getHousehold, openNeeds, payeeEmail } from "@/lib/households";
import { createRoutedOrder, describePayPalError } from "@/lib/paypal/orders";
import { routeGift } from "@/lib/routing";
import { DEFAULT_PROFILE, type Profile } from "@/lib/rules";

const Body = z.object({ slug: z.string().min(1).max(60), amount: z.number().min(1).max(10000) });

/**
 * "Give any amount": the server routes the gift with the rules engine (never trusting the browser),
 * then creates ONE PayPal order with a purchase unit, and a payee, for every recipient.
 */
export async function POST(req: Request) {
  const started = Date.now();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request", "Enter an amount between $1 and $10,000.", 400);
  const data = await getHousehold(parsed.data.slug);
  if (!data) return fail("not_found", "That gift page was not found.", 404);

  const profile = { ...DEFAULT_PROFILE, ...(data.household.profile as Partial<Profile>) };
  const plan = routeGift(parsed.data.amount, openNeeds(data.needs), today(), profile);
  if (plan.lines.length === 0) return fail("invalid_request", "There is no benefit-safe way to place this gift right now.", 422);
  if (plan.checkWithRouting < plan.baseline) return fail("invalid_request", "This gift would lower her check, so Giftwise did not create it.", 422);

  try {
    const units = plan.lines.map((l) => ({ referenceId: l.referenceId, description: l.needId ? `${l.title} for ${data.household.name}` : `Savings in ${data.household.name}'s ABLE account`, amount: l.amount, payeeEmail: payeeEmail(l.payeeAccount) }));
    const order = await createRoutedOrder(units, `gift-${data.household.id}-${crypto.randomUUID()}`);
    await db()
      .insert(schema.payments)
      .values(
        plan.lines.map((l, i) => ({
          needId: l.needId,
          householdId: data.household.id,
          orderId: order.id!,
          referenceId: l.referenceId,
          payeeName: l.payeeName,
          route: l.route,
          status: "created",
          amount: l.amount.toFixed(2),
          payeeEmail: units[i].payeeEmail,
        })),
      );
    await audit("person", "paypal.routed_order.created", `order:${order.id}`, {
      amount: plan.amount,
      units: plan.lines.map((l) => ({ ref: l.referenceId, amount: l.amount, route: l.route, rules: l.ruleIds })),
      checkIfCash: plan.checkIfCash,
      checkWithRouting: plan.checkWithRouting,
    });
    return ok({ id: order.id, status: order.status, plan }, started);
  } catch (e) {
    const d = describePayPalError(e);
    console.error("routed order failed", d.issue, d.debugId);
    return fail("upstream_unavailable", d.plain, d.status >= 400 && d.status < 600 ? d.status : 502, { issue: d.issue, debug_id: d.debugId });
  }
}
