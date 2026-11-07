import field from "../../content/eval/field-cases-results.json";
import sample from "../../content/sample-year.json";
import { SAMPLE } from "./households";
import { DEFAULT_PROFILE, evaluateGift, type Category, type Delivery, type Profile } from "./rules";

/**
 * The dollar figures the home page, /evidence, /about and the README lead with, each computed here from the files in
 * content/ so every place shows the same number (tests/docs-numbers.test.ts holds the README to them).
 */
const routed = field.summary.dollars.as_shown_in_the_opinions;
const asked = field.summary.overpayments_stated;

export const IMPACT = {
  /** Federal court cases scored, and those whose facts allow a benefit-safe route. */
  scoredCases: field.summary.scored,
  routedCases: routed.cases_where_routing_keeps_money,
  /** What routing the same help keeps a month in those cases, at 2026 rates, in all and for each person. */
  keptMonthly: routed.kept_per_month_2026,
  keptMonthlyPerPerson: Math.round(routed.kept_per_month_2026 / routed.cases_where_routing_keeps_money),
  /** Overpayments SSA assessed, as the opinions state them: what it asked to be paid back. */
  askedBack: asked.scored_total,
  askedBackCases: asked.scored.length,
} as const;

type SampleGift = { date: string; amount: number; delivery: Delivery; category: Category; recurring?: boolean };

/**
 * The sample year, run for real: each gift through the rules engine, then grouped by how the money would move outside
 * the sandbox. Shops are paid through PayPal; the ABLE share goes through the person's ABLE plan's own gift page; a gift
 * given as the item itself moves no money through Giftwise. Every gift must keep her check whole.
 */
export function sampleYearSplit() {
  const profile: Profile = { ...DEFAULT_PROFILE, ...(SAMPLE.profile as Partial<Profile>) };
  const gifts = (sample.gifts as SampleGift[]).map((g, i) => ({ g, r: evaluateGift({ id: `s${i}`, ...g }, profile) }));
  const part = (d: Delivery) => {
    const rows = gifts.filter((x) => x.g.delivery === d);
    return { gifts: rows.length, amount: rows.reduce((s, x) => s + x.g.amount, 0) };
  };
  const total = gifts.reduce((s, x) => s + x.g.amount, 0);
  return {
    total,
    gifts: gifts.length,
    paypal: part("vendor"),
    able: part("able"),
    item: part("item"),
    cash: part("cash"),
    checkWhole: gifts.filter((x) => x.r.checkAfter === x.r.checkBaseline).length,
  };
}
