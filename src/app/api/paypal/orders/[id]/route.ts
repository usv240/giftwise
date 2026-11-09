import { fail, ok } from "@/lib/api/envelope";
import { orderView, readOrder } from "@/lib/paypal/orders";
import { api } from "@/lib/api/handler";
import { log } from "@/lib/log";

/**
 * GET /api/paypal/orders/{id}: the order as PayPal sees it right now (status, each payee, each capture). Read over REST
 * (readOrder in src/lib/paypal/orders.ts), so a captured order with several payees reads as PayPal sends it.
 */
async function getRoute(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const started = Date.now();
  const { id } = await ctx.params;
  if (!/^[A-Z0-9]{10,24}$/.test(id)) return fail("invalid_request", "That order id does not look right.", 400);
  try {
    const r = await readOrder(id);
    if (!r.ok) return fail(r.status === 404 ? "not_found" : "upstream_unavailable", r.plain, r.status < 600 ? r.status : 502, { issue: r.issue, debug_id: r.debugId });
    return ok(orderView(r.order), started, { source: "PayPal Orders v2, live" });
  } catch (e) {
    log.warn("order read did not reach PayPal", { err: e });
    return fail("upstream_unavailable", "PayPal could not complete this step. Please try again.", 502, { issue: "UNREACHABLE" });
  }
}

export const GET = api("/api/paypal/orders/[id]", getRoute);
