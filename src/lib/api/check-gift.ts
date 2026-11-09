import { z } from "zod";
import sources from "../../../content/sources.json";
import type { GiftResult, ResourceTest } from "@/lib/rules";

const SRC = sources as Record<string, { title: string; url: string }>;

/** A resource test in the API's snake_case, with the day it is for. */
const resources = (t: ResourceTest) => ({ on: t.on, countable: t.countable, other: t.other, able_balance: t.ableBalance, able_excess: t.ableExcess, limit: t.limit, over: t.over, status: t.status });

/**
 * The data of POST /api/v1/check-gift. The two resource tests are named for the day each is for, and each carries that
 * day: `resources_after_gift` on the 1st of the month after the gift, with the gift as given (cash she keeps adds to
 * savings, an ABLE deposit to the account), and `resources_for_check` on the 1st of the month the check is paid, the
 * test that decides that check. The four flat fields before them stay for API version 1 and describe the same days.
 */
export function checkGiftData(r: GiftResult) {
  return {
    check_before: r.checkBaseline,
    check_after: r.checkAfter,
    counted_amount: r.countedAmount,
    income_month: r.incomeMonth,
    payment_month: r.paymentMonth,
    best_route: r.bestRoute,
    check_with_best_route: r.checkWithBestRoute,
    routes: r.alternatives,
    resources_after_gift: resources(r.resourcesAfter),
    resources_for_check: resources(r.trace.resources),
    // Kept for version 1: the same values as resources_after_gift.countable, .over and .able_balance, and resources_for_check.status.
    savings_on_next_first: r.resourcesNextFirst,
    over_savings_limit: r.overResourceLimit,
    able_balance_on_next_first: r.resourcesAfter.ableBalance,
    resource_status: r.trace.resources.status,
    ambiguous: r.ambiguous,
    ambiguity_reason: r.ambiguityReason ?? null,
    rule_ids: r.ruleIds,
    citations: r.sourceKeys.map((k) => ({ id: k, title: SRC[k]?.title ?? k, url: SRC[k]?.url ?? null })),
    explanation: r.explanation,
    trace: r.trace,
  };
}

const Resources = (about: string) =>
  z
    .object({
      on: z.string().describe("The day the test is for, YYYY-MM-01."),
      countable: z.number().describe("Countable resources that day: other resources plus the ABLE balance over $100,000."),
      other: z.number().describe("Savings and other countable resources, before any ABLE balance."),
      able_balance: z.number().describe("The ABLE balance that day."),
      able_excess: z.number().describe("The part of the ABLE balance over $100,000, which counts as a resource."),
      limit: z.number().describe("The resource limit: $2,000, or $3,000 for a couple."),
      over: z.boolean().describe("True when countable resources are over the limit."),
      status: z.enum(["under", "able_suspension", "excess"]).describe("under: at or below the limit. able_suspension: over only because of the ABLE balance, so SSI cash stops and Medicaid continues. excess: over on other resources alone."),
    })
    .describe(about);

/** The response's data, for /openapi.json and the docs page. The trace and explanation are described in brief. */
export const CheckGiftData = z.object({
  check_before: z.number().describe("Her check for the payment month with no gift."),
  check_after: z.number().describe("Her check for the payment month with the gift as given."),
  counted_amount: z.number().describe("How much of the gift counts as income after exclusions."),
  income_month: z.string().describe("The month the gift counts in, YYYY-MM: the month it arrives."),
  payment_month: z.string().describe("The month whose check the income month decides, two months later, YYYY-MM."),
  best_route: z.enum(["cash", "vendor", "item", "able"]).describe("The way to give it that keeps the most of her check."),
  check_with_best_route: z.number().describe("Her check for the payment month on the best route."),
  routes: z.array(z.object({ delivery: z.string(), check: z.number(), possible: z.boolean(), reason: z.string().optional() })).describe("Every way to give it, with the check each leaves."),
  resources_after_gift: Resources("The resource test on the 1st of the month after the gift arrives, with the gift as given: cash she keeps adds to savings, an ABLE deposit to the account."),
  resources_for_check: Resources("The resource test on the 1st of the payment month, which decides that check: over the limit, the check is $0. It counts the savings she states and the ABLE deposits; cash kept from the gift is in resources_after_gift."),
  savings_on_next_first: z.number().describe("Deprecated, kept for version 1: resources_after_gift.countable."),
  over_savings_limit: z.boolean().describe("Deprecated, kept for version 1: resources_after_gift.over, for the 1st of the month after the gift."),
  able_balance_on_next_first: z.number().describe("Deprecated, kept for version 1: resources_after_gift.able_balance."),
  resource_status: z.enum(["under", "able_suspension", "excess"]).describe("Deprecated, kept for version 1: resources_for_check.status, for the 1st of the payment month."),
  ambiguous: z.boolean().describe("True when the rules leave room for doubt, for example whether a bill is a utility."),
  ambiguity_reason: z.string().nullable().describe("Why, when ambiguous."),
  rule_ids: z.array(z.string()).describe("The rules applied, from the rule table."),
  citations: z.array(z.object({ id: z.string(), title: z.string(), url: z.string().nullable() })).describe("The regulation or POMS section behind each rule."),
  explanation: z.object({ plain: z.string(), technical: z.string() }).describe("The answer in plain words, and with the numbers."),
  trace: z.record(z.string(), z.unknown()).describe("The month's arithmetic, step by step."),
});
