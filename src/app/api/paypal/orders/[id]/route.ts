import { fail, ok } from "@/lib/api/envelope";
import { describePayPalError, getOrder } from "@/lib/paypal/orders";
import { api } from "@/lib/api/handler";

/** GET /api/paypal/orders/{id}: the order as PayPal sees it right now (status, each payee, each capture). */
async function getRoute(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!/^[A-Z0-9]{10,24}$/.test(id)) return fail("invalid_request", "That order id does not look right.", 400);
  try {
    const o = await getOrder(id);
    return ok(
      {
        id: o.id,
        status: o.status,
        units: (o.purchaseUnits ?? []).map((pu) => ({
          reference_id: pu.referenceId,
          amount: pu.amount?.value,
          payee_email: pu.payee?.emailAddress ?? null,
          captures: (pu.payments?.captures ?? []).map((c) => ({ id: c.id, status: c.status, amount: c.amount?.value })),
        })),
      },
      started,
      { source: "PayPal Orders v2, live" },
    );
  } catch (e) {
    const d = describePayPalError(e);
    return fail("upstream_unavailable", d.plain, d.status >= 400 && d.status < 600 ? d.status : 502, { issue: d.issue });
  }
}

export const GET = api("/api/paypal/orders/[id]", getRoute);
