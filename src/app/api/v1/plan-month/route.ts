import { guard } from "@/lib/api/keys";
import { fail, ok } from "@/lib/api/envelope";
import { PlanMonthRequest } from "@/lib/api/schemas";
import { DEFAULT_PROFILE, planMonths } from "@/lib/rules";

/** POST /api/v1/plan-month: a list of gifts, the check for each affected month, and suggestions. */
async function handle(req: Request) {
  const started = Date.now();
  const parsed = PlanMonthRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request", "Send JSON with a gifts array. Each gift needs date, amount and delivery.", 400, parsed.error.issues);
  const { gifts, profile } = parsed.data;
  const plan = planMonths(
    gifts.map((g, i) => ({ id: `g${i}`, ...g })),
    { ...DEFAULT_PROFILE, ...profile },
  );
  return ok(
    {
      months: plan.months,
      gifts: plan.gifts.map((r) => ({
        label: r.gift.label ?? null,
        giver: r.gift.giver ?? null,
        amount: r.gift.amount,
        counted_amount: r.countedAmount,
        best_route: r.bestRoute,
        rule_ids: r.ruleIds,
        explanation: r.explanation,
      })),
    },
    started,
  );
}

export const POST = (req: Request) => guard(req, "plan-month", () => handle(req));
