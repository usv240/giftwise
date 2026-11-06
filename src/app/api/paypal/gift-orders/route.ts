import { z } from "zod";
import { fail, ok } from "@/lib/api/envelope";
import { startRoutedGift } from "@/lib/paypal/gift-order";
import { api } from "@/lib/api/handler";

const Body = z.object({ slug: z.string().min(1).max(60), amount: z.number().min(1).max(10000) });

/**
 * "Give any amount": the server routes the gift with the rules engine (never trusting the browser),
 * then creates ONE PayPal order with a purchase unit, and a payee, for every recipient.
 */
async function postRoute(req: Request) {
  const started = Date.now();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request", "Enter an amount between $1 and $10,000.", 400);
  const r = await startRoutedGift(parsed.data.slug, parsed.data.amount, { actor: "person" });
  if (!r.ok) return fail(r.code, r.message, r.status, r.details);
  return ok({ id: r.orderId, status: r.status, plan: r.plan }, started);
}

export const POST = api("/api/paypal/gift-orders", postRoute);
