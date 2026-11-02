import { z } from "zod";
import { fail, ok, today } from "@/lib/api/envelope";
import { audit } from "@/lib/audit";
import { db, schema } from "@/lib/db";
import { getNeed, payeeEmail } from "@/lib/households";
import { createPayeeOrder, describePayPalError } from "@/lib/paypal/orders";
import { DEFAULT_PROFILE, evaluateGift, type Category, type Delivery } from "@/lib/rules";

const Body = z.object({ needId: z.number().int().positive() });

/**
 * Create a sandbox PayPal order for one need. The server decides the amount and the payee
 * (the shop or her ABLE account) from the need record; the browser only says which need.
 */
export async function POST(req: Request) {
  const started = Date.now();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request", "Choose which need to pay for.", 400);
  const need = await getNeed(parsed.data.needId);
  if (!need) return fail("not_found", "That need was not found.", 404);
  if (need.status === "paid") return fail("invalid_request", "This need is already paid. Thank you!", 409);

  // Check the rule before money moves: the route must keep her full check.
  const amount = Number(need.amount) - Number(need.funded);
  const check = evaluateGift(
    { id: `need-${need.id}`, date: today(), amount, delivery: need.route as Delivery, category: need.category as Category, recurring: need.recurring },
    DEFAULT_PROFILE,
  );
  if (check.checkAfter < check.checkBaseline) {
    return fail("invalid_request", "This route would lower her check, so Giftwise suggests a different way to give.", 422);
  }

  try {
    const email = payeeEmail(need.payeeAccount);
    const order = await createPayeeOrder({
      amount,
      payeeEmail: email,
      description: `${need.title} for Maya, paid to ${need.payeeName}`,
      referenceId: `need-${need.id}`,
      requestId: `need-${need.id}-${crypto.randomUUID()}`,
      softDescriptor: "GIFTWISE",
    });
    await db().insert(schema.payments).values({
      needId: need.id,
      householdId: need.householdId,
      orderId: order.id!,
      referenceId: `need-${need.id}`,
      payeeName: need.payeeName,
      route: need.route,
      status: "created",
      amount: (Number(need.amount) - Number(need.funded)).toFixed(2),
      payeeEmail: email,
    });
    await audit("person", "paypal.order.created", `need:${need.id}`, { orderId: order.id, amount: need.amount, payee: need.payeeAccount, ruleIds: check.ruleIds });
    return ok({ id: order.id, status: order.status, rule_ids: check.ruleIds, check_after: check.checkAfter }, started);
  } catch (e) {
    const d = describePayPalError(e);
    console.error("create order failed", d.issue, d.debugId);
    return fail("upstream_unavailable", d.plain, d.status >= 400 && d.status < 600 ? d.status : 502, { issue: d.issue, debug_id: d.debugId });
  }
}
