import { guard } from "@/lib/api/keys";
import { fail, ok, today } from "@/lib/api/envelope";
import { CheckGiftRequest } from "@/lib/api/schemas";
import { DEFAULT_PROFILE, evaluateGift } from "@/lib/rules";
import sources from "../../../../../content/sources.json";
import { api } from "@/lib/api/handler";

const SRC = sources as Record<string, { title: string; url: string }>;

/** POST /api/v1/check-gift: how one gift affects SSI, and the best way to deliver it. */
async function handle(req: Request) {
  const started = Date.now();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_request", "The request body must be JSON.", 400);
  }
  const parsed = CheckGiftRequest.safeParse(body);
  if (!parsed.success) {
    return fail("invalid_request", "Some fields are missing or not valid. See details.", 400, parsed.error.issues);
  }
  const { gift, profile } = parsed.data;
  const r = evaluateGift(
    { id: "api", date: gift.date ?? today(), amount: gift.amount, delivery: gift.delivery, category: gift.category, recurring: gift.recurring, giver: gift.giver, label: gift.label },
    { ...DEFAULT_PROFILE, ...profile },
  );
  return ok(
    {
      check_before: r.checkBaseline,
      check_after: r.checkAfter,
      counted_amount: r.countedAmount,
      income_month: r.incomeMonth,
      payment_month: r.paymentMonth,
      best_route: r.bestRoute,
      check_with_best_route: r.checkWithBestRoute,
      routes: r.alternatives,
      savings_on_next_first: r.resourcesNextFirst,
      over_savings_limit: r.overResourceLimit,
      ambiguous: r.ambiguous,
      ambiguity_reason: r.ambiguityReason ?? null,
      rule_ids: r.ruleIds,
      citations: r.sourceKeys.map((k) => ({ id: k, title: SRC[k]?.title ?? k, url: SRC[k]?.url ?? null })),
      explanation: r.explanation,
      trace: r.trace,
    },
    started,
  );
}

const postRoute = (req: Request) => guard(req, "check-gift", () => handle(req));

export const POST = api("/api/v1/check-gift", postRoute);
