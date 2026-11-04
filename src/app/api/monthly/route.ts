import { z } from "zod";
import { fail, ok, today } from "@/lib/api/envelope";
import { dbConfigured } from "@/lib/db";
import { startMonthly } from "@/lib/monthly";
import { monthOf } from "@/lib/rules";

const Body = z.object({
  slug: z.string().min(1).max(60),
  amount: z.number().min(1).max(10000),
  giver_name: z.string().max(60).optional(),
  /** The PayPal order the giver just paid, recorded as the first month. */
  order_id: z.string().regex(/^[A-Z0-9]{10,24}$/).optional(),
});

/** Start a monthly gift. Returns the giver's own link, where each month's split is shown and approved. */
export async function POST(req: Request) {
  const started = Date.now();
  if (!dbConfigured()) return fail("upstream_unavailable", "Monthly gifts need the database, which is not connected here.", 503);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request", "Send a gift page id and an amount between $1 and $10,000.", 400);
  const r = await startMonthly({ slug: parsed.data.slug, amount: parsed.data.amount, giverName: parsed.data.giver_name, firstOrderId: parsed.data.order_id, month: monthOf(today()) });
  if (!r) return fail("not_found", "That gift page was not found.", 404);
  return ok({ token: r.token, url: `/m/${r.token}` }, started);
}
