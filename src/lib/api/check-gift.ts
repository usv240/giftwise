import { z } from "zod";
import sources from "../../../content/sources.json";
import { householdSentence, type GiftResult, type Profile, type ResourceTest } from "@/lib/rules";

const SRC = sources as Record<string, { title: string; url: string }>;

/** A resource test in the API's snake_case, with the day it is for. */
const resources = (t: ResourceTest) => ({ on: t.on, countable: t.countable, other: t.other, able_balance: t.ableBalance, able_excess: t.ableExcess, limit: t.limit, over: t.over, status: t.status });

/**
 * Her place in another person's household for the payment month (R-SHEL-08), in the API's snake_case: her pro rata share
 * of its costs, what she pays, and whether the household already lowers her check before any gift. Null when she does
 * not live in another person's household.
 */
export function householdData(r: GiftResult, profile: Pick<Profile, "pronoun" | "couple"> = { couple: false }) {
  const h = r.trace.household;
  if (!h) return null;
  const words = householdSentence(h, { couple: profile.couple, pronoun: profile.pronoun, livesInAnothersHousehold: true, otherUnearnedMonthly: 0, earnedMonthly: 0, ableEligible: false, ableBalance: 0, ableContributedThisYear: 0, savings: 0 }, r.trace.paymentMonth);
  return {
    rule: h.rule,
    pro_rata_share: h.share,
    pays: h.pays,
    short_by: h.share === null ? null : Math.round(Math.max(0, h.share - h.pays) * 100) / 100,
    sharing: h.sharing,
    shelter_value: h.value,
    lowers_check_before_gift: h.rule !== "none",
    plain: words || null,
  };
}

/**
 * The data of POST /api/v1/check-gift. The two resource tests are named for the day each is for, and each carries that
 * day: `resources_after_gift` on the 1st of the month after the gift, with the gift as given (cash she keeps adds to
 * savings, an ABLE deposit to the account), and `resources_for_check` on the 1st of the month the check is paid, the
 * test that decides that check. The four flat fields before them stay for API version 1 and describe the same days.
 */
export function checkGiftData(r: GiftResult, profile?: Pick<Profile, "pronoun" | "couple">) {
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
    household: householdData(r, profile),
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
  household: z
    .object({
      rule: z.enum(["vtr", "pmv", "none"]).describe("vtr: the one-third reduction, because the household gives her shelter and all her meals. pmv: the shelter it gives her counts as housing support up to the presumed maximum value. none: she pays her share."),
      pro_rata_share: z.number().nullable().describe("Her pro rata share of the household's monthly costs (the couple's together), or null when not known."),
      pays: z.number().describe("What she pays toward them each month, with any bona fide loan of the household's shelter."),
      short_by: z.number().nullable().describe("How far what she pays falls short of her share, or null when her share is not known."),
      sharing: z.boolean().describe("True when she pays her share, or within $20 of it, so the household does not lower her check."),
      shelter_value: z.number().describe("Under pmv, the value of the shelter the household gives her; 0 otherwise."),
      lowers_check_before_gift: z.boolean().describe("True when the household already lowers her check, whatever the gift."),
      plain: z.string().nullable().describe("The same in plain words, as the explanation says it."),
    })
    .nullable()
    .describe("Only when profile.livesInAnothersHousehold is true: her place in that household for the payment month (POMS SI 00835.160, 20 CFR 416.1131 and 416.1133). Null otherwise."),
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
