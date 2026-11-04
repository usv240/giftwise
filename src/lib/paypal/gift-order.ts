import { today } from "@/lib/api/envelope";
import { audit } from "@/lib/audit";
import { db, schema } from "@/lib/db";
import { getHousehold, openNeeds, payeeEmail } from "@/lib/households";
import { createRoutedOrder, describePayPalError } from "@/lib/paypal/orders";
import { routeGift, type RoutedGift } from "@/lib/routing";
import { DEFAULT_PROFILE, type Profile } from "@/lib/rules";

export type StartedGift =
  | { ok: true; orderId: string; status: string; approveUrl: string | null; plan: RoutedGift; name: string }
  | { ok: false; code: "not_found" | "invalid_request" | "upstream_unavailable"; message: string; status: number; details?: unknown };

/**
 * Route a gift with the rules engine (never trusting the caller), then create ONE PayPal order with a purchase unit,
 * and a payee, for every recipient. Used by the gift page's button and by AI agents through the MCP server.
 * With redirect set, PayPal returns an approval link for a person to open; Giftwise captures when PayPal sends them back.
 */
export async function startRoutedGift(
  slug: string,
  amount: number,
  o: { actor: "person" | "agent"; redirect?: { returnUrl: string; cancelUrl: string }; plan?: (household: { needs: Parameters<typeof openNeeds>[0]; payments: NonNullable<Awaited<ReturnType<typeof getHousehold>>>["payments"]; profile: Profile; name: string }) => RoutedGift; tag?: string },
): Promise<StartedGift> {
  const data = await getHousehold(slug);
  if (!data) return { ok: false, code: "not_found", message: "That gift page was not found.", status: 404 };

  const profile = { ...DEFAULT_PROFILE, ...(data.household.profile as Partial<Profile>) };
  // A monthly gift passes its own planner (that month's needs); either way the server, never the caller, routes it.
  const plan = o.plan ? o.plan({ needs: data.needs, payments: data.payments, profile, name: data.household.name }) : routeGift(amount, openNeeds(data.needs), today(), profile, `${data.household.name}'s ABLE account`);
  if (plan.lines.length === 0) return { ok: false, code: "invalid_request", message: "There is no benefit-safe way to place this gift right now.", status: 422 };
  if (plan.checkWithRouting < plan.baseline) return { ok: false, code: "invalid_request", message: "This gift would lower the SSI check, so Giftwise did not create it.", status: 422 };

  try {
    const units = plan.lines.map((l) => ({
      referenceId: l.referenceId,
      description: l.needId ? `${l.title} for ${data.household.name}` : `Savings in ${data.household.name}'s ABLE account`,
      amount: l.amount,
      payeeEmail: payeeEmail(l.payeeAccount),
    }));
    const order = await createRoutedOrder(units, `gift-${data.household.id}-${crypto.randomUUID()}`, o.redirect);
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
    await audit(o.actor, "paypal.routed_order.created", `order:${order.id}`, {
      amount: plan.amount,
      units: plan.lines.map((l) => ({ ref: l.referenceId, amount: l.amount, route: l.route, rules: l.ruleIds })),
      checkIfCash: plan.checkIfCash,
      checkWithRouting: plan.checkWithRouting,
      via: o.redirect ? "approval_link" : "button",
      ...(o.tag ? { tag: o.tag } : {}),
    });
    const approveUrl = order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href ?? null;
    return { ok: true, orderId: order.id!, status: String(order.status), approveUrl, plan, name: data.household.name };
  } catch (e) {
    const d = describePayPalError(e);
    console.error("routed order failed", d.issue, d.debugId);
    return { ok: false, code: "upstream_unavailable", message: d.plain, status: d.status >= 400 && d.status < 600 ? d.status : 502, details: { issue: d.issue, debug_id: d.debugId } };
  }
}
