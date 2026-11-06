import { z } from "zod";
import { fail, ok, today } from "@/lib/api/envelope";
import { log } from "@/lib/log";
import { audit } from "@/lib/audit";
import { db, schema } from "@/lib/db";
import { getNeed, payeeEmail } from "@/lib/households";
import { createPayeeOrder, describePayPalError } from "@/lib/paypal/orders";
import { eq } from "drizzle-orm";
import { DEFAULT_PROFILE, evaluateGift, type Category, type Delivery, type Profile } from "@/lib/rules";
import { api } from "@/lib/api/handler";

const Body = z.object({ needId: z.number().int().positive() });

/**
 * Create a sandbox PayPal order for one need. The server decides the amount and the payee
 * (the shop or her ABLE account) from the need record; the browser only says which need.
 */
async function postRoute(req: Request) {
  const started = Date.now();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request", "Choose which need to pay for.", 400);
  const need = await getNeed(parsed.data.needId);
  if (!need) return fail("not_found", "That need was not found.", 404);
  if (need.status === "paid") return fail("invalid_request", "This need is already paid. Thank you!", 409);
  const [household] = await db().select().from(schema.households).where(eq(schema.households.id, need.householdId)).limit(1);
  if (household?.status === "closed") return fail("invalid_request", `${household.name}'s page is closed to new gifts. Its receipts stay public.`, 409);
  const profile: Profile = { ...DEFAULT_PROFILE, ...((household?.profile ?? {}) as Partial<Profile>) };
  const name = household?.name ?? "them";

  // Check the rule before money moves: the route must keep her full check.
  const amount = Number(need.amount) - Number(need.funded);
  const check = evaluateGift(
    { id: `need-${need.id}`, date: today(), amount, delivery: need.route as Delivery, category: need.category as Category, recurring: need.recurring },
    profile,
  );
  if (check.checkAfter < check.checkBaseline) {
    return fail("invalid_request", `This route would lower ${name}'s check, so Giftwise suggests a different way to give.`, 422);
  }

  try {
    const email = payeeEmail(need.payeeAccount);
    const order = await createPayeeOrder({
      amount,
      payeeEmail: email,
      description: `${need.title} for ${name}, paid to ${need.payeeName}`,
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
    log.error("create order failed", { issue: d.issue, debugId: d.debugId, status: d.status });
    return fail("upstream_unavailable", d.plain, d.status >= 400 && d.status < 600 ? d.status : 502, { issue: d.issue, debug_id: d.debugId });
  }
}

export const POST = api("/api/paypal/orders", postRoute);
