import field from "../../content/eval/field-cases-results.json";
import sample from "../../content/sample-year.json";
import { SAMPLE } from "./households";
import { DEFAULT_PROFILE, P, SHELTER_CATEGORIES, evaluateGift, planMonths, type Category, type Delivery, type Profile } from "./rules";
import { MAX_UNITS } from "./routing";

/**
 * The dollar figures the home page, /evidence, /about and the README lead with, each computed here from the files in
 * content/ so every place shows the same number (tests/docs-numbers.test.ts holds the README to them).
 */
const routed = field.summary.dollars.as_shown_in_the_opinions;
const asked = field.summary.overpayments_stated;

/** Each scored court case where the engine's benefit-safe route keeps money, with what it keeps a month at 2026 rates. */
const keptCases = field.cases
  .filter((c) => c.dollars.computed && (c.dollars.kept_per_month ?? 0) > 0)
  .map((c) => ({ id: c.id, title: c.title, citation: c.citation, kept: c.dollars.kept_per_month as number, years: (c.dollars.months ?? []).map((m) => Number(m.month.slice(0, 4))) }));
const keptYears = keptCases.flatMap((c) => c.years);

/** Each case where SSA asked money back: the amount, and whether the same help routed through Giftwise keeps her savings under the limit. */
const askedCases = asked.scored.map((o) => {
  const able = o.routed.find((r) => r.route === "able");
  return { id: o.id, title: o.title, amount: o.amount, period: o.period, monthsOverAsGiven: o.as_given_months_over_limit.length, avoidedThroughAble: Boolean(able?.avoided), needsAbleEligibility: Boolean(able?.needs_able_eligibility) };
});

export const IMPACT = {
  /** Federal court cases scored, and those whose facts allow a benefit-safe route. */
  scoredCases: field.summary.scored,
  routedCases: routed.cases_where_routing_keeps_money,
  /** What routing the same help keeps a month in those cases, at 2026 rates, in all. */
  keptMonthly: routed.kept_per_month_2026,
  /** The engine's counterfactual on those cases: the least and most it keeps a month, at 2026 rates, and the years their facts come from. */
  keptMin: Math.min(...keptCases.map((c) => c.kept)),
  keptMax: Math.max(...keptCases.map((c) => c.kept)),
  keptCases,
  keptFromYear: Math.min(...keptYears),
  keptToYear: Math.max(...keptYears),
  /** Overpayments SSA assessed, as the opinions state them: what it asked to be paid back, case by case. */
  askedBack: asked.scored_total,
  askedBackCases: asked.scored.length,
  askedCases,
  /** Of those, the cases where the engine finds the same help paid into an ABLE account keeps her savings under $2,000 every month. */
  askedAvoidedThroughAble: askedCases.filter((c) => c.avoidedThroughAble).length,
} as const;

const whole = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const dollarsCents = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * The court-case claim in one sentence, the same wherever it is shown: the engine's counterfactual on real cases, not an
 * observed outcome. "In 4 of 14 real court cases, the same help routed through Giftwise would have kept $331 to $663 a
 * month at 2026 rates."
 */
export const KEPT_SENTENCE = `In ${IMPACT.routedCases} of ${IMPACT.scoredCases} real court cases, the same help routed through Giftwise would have kept ${whole(IMPACT.keptMin)} to ${whole(IMPACT.keptMax)} a month at 2026 rates.`;
/** Where those figures come from, in plain words. */
export const KEPT_BASIS = `The rules engine's counterfactual: each case's facts (from ${IMPACT.keptFromYear} to ${IMPACT.keptToYear}) repriced at 2026 rates, with the help routed the benefit-safe way; ${IMPACT.keptCases.filter((c) => c.kept === IMPACT.keptMin).length} cases at ${dollarsCents(IMPACT.keptMin)} and ${IMPACT.keptCases.filter((c) => c.kept === IMPACT.keptMax).length} at ${dollarsCents(IMPACT.keptMax)}.`;
/** The overpayment claim, case by case. */
export const ASKED_SENTENCE = `In ${IMPACT.askedBackCases === 2 ? "two" : IMPACT.askedBackCases} of the court cases, SSA asked for money back: ${IMPACT.askedCases.map((c) => `${dollarsCents(c.amount)} (${c.title.charAt(0).toLowerCase()}${c.title.slice(1)})`).join(" and ")}.`;
export const ASKED_BASIS = `Run through the engine from each case's facts, the same help paid into an ABLE account keeps her savings under $2,000 in every month in ${IMPACT.askedAvoidedThroughAble === IMPACT.askedBackCases ? `both cases` : `${IMPACT.askedAvoidedThroughAble} of ${IMPACT.askedBackCases}`}, so there would have been nothing to ask back. ABLE needs the disability to have begun before age 46, which these opinions do not state.`;

type SampleGift = { date: string; amount: number; delivery: Delivery; category: Category; recurring?: boolean; giver?: string; need?: string };

/**
 * "Why not pay the shop yourself?", measured on the sample year: the same 43 gifts, each giver paying on their own with
 * no shared page. A housing bill (rent, a utility) paid straight to the landlord or the utility counts as help with
 * housing; a gift with no shop behind it (savings) goes as cash; everything else is paid to its shop as before. The
 * engine prices both years month by month.
 */
export function payItYourself() {
  const profile: Profile = { ...DEFAULT_PROFILE, ...(SAMPLE.profile as Partial<Profile>) };
  const gifts = (sample.gifts as SampleGift[]).map((g, i) => ({ id: `s${i}`, label: g.need, ...g }));
  const own = gifts.map((g) => (g.delivery !== "able" ? g : { ...g, delivery: (SHELTER_CATEGORIES.includes(g.category) ? "vendor" : "cash") as Delivery }));
  const withGiftwise = planMonths(gifts, profile).months;
  const alone = planMonths(own, profile).months;
  const lowered = alone.map((m, i) => ({ month: m.month, paid: m.month, lost: Math.round((withGiftwise[i].check - m.check) * 100) / 100 })).filter((m) => m.lost > 0);
  const counts = (m: (typeof alone)[number]) => m.countableIncome > 0 || m.ismValue > 0 || m.vtrApplied;
  const housing = own.filter((g, i) => gifts[i].delivery === "able" && g.delivery === "vendor");
  const cash = own.filter((g, i) => gifts[i].delivery === "able" && g.delivery === "cash");
  const ableGifts = gifts.filter((g) => g.delivery === "able");
  return {
    gifts: gifts.length,
    givers: new Set(gifts.map((g) => g.giver)).size,
    needs: new Set(gifts.map((g) => g.need)).size,
    housingGifts: housing.length,
    housingAmount: housing.reduce((s, g) => s + g.amount, 0),
    cashGifts: cash.length,
    cashAmount: cash.reduce((s, g) => s + g.amount, 0),
    /** Months whose check would drop, and by how much in all, paying alone; with Giftwise every month stays whole. */
    monthsLowered: lowered.length,
    totalLowered: Math.round(lowered.reduce((s, m) => s + m.lost, 0) * 100) / 100,
    /** Months with income or housing help to tell SSA about, paying alone and with Giftwise. */
    reportMonthsAlone: alone.filter(counts).length,
    reportMonthsGiftwise: withGiftwise.filter(counts).length,
    /** ABLE's yearly limit counts every giver's deposits together; Giftwise sums them across the page. */
    ableGivers: new Set(ableGifts.map((g) => g.giver)).size,
    ableAmount: ableGifts.reduce((s, g) => s + g.amount, 0),
    ableLimit: P.ableAnnualLimit,
    maxRecipients: MAX_UNITS,
  };
}

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
