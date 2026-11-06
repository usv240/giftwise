import { fail, ok, today } from "@/lib/api/envelope";
import { monthlyView, planMonth } from "@/lib/monthly";
import { addMonths, monthOf } from "@/lib/rules";
import { api } from "@/lib/api/handler";

/**
 * Plan the next month now. In real use each month is planned when it begins; in the sandbox this lets a visitor see the
 * rules route the same gift again for the month after, up to a year ahead.
 */
async function postRoute(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const started = Date.now();
  const { token } = await ctx.params;
  const v = await monthlyView(token, today());
  if (!v) return fail("not_found", "That monthly gift was not found.", 404);
  if (v.status !== "active") return fail("invalid_request", "This monthly gift is stopped.", 409);
  if (v.nextMonth > addMonths(monthOf(today()), 12)) return fail("invalid_request", "Months are planned up to a year ahead.", 409);
  const run = await planMonth(token, v.nextMonth);
  return ok({ month: run?.month ?? v.nextMonth }, started);
}

export const POST = api("/api/monthly/[token]/next", postRoute);
