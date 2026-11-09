import field from "../../content/eval/field-cases-results.json";
import sample from "../../content/sample-year.json";
import { SAMPLE } from "./households";
import { DEFAULT_PROFILE, P, SHELTER_CATEGORIES, evaluateGift, planMonths, usd, type Category, type Delivery, type Profile } from "./rules";
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

/**
 * The cases whose opinions state how many months the help lasted: what the engine keeps for that family over those
 * months, from the case's own facts (the amount it keeps each month, repriced at 2026 rates, times the months stated).
 */
const familyCases = field.cases
  .filter((c) => c.dollars.computed && (c.dollars.kept_over_stated_months ?? 0) > 0)
  .map((c) => ({ id: c.id, title: c.title, citation: c.citation, months: c.dollars.months_stated as number, perMonth: c.dollars.kept_per_month as number, total: c.dollars.kept_over_stated_months as number }))
  .sort((a, b) => a.total - b.total);
const familyTotal = Math.round(familyCases.reduce((s, c) => s + c.total, 0) * 100) / 100;
if (familyTotal !== routed.kept_over_stated_months_2026 || familyCases.length !== routed.cases_with_stated_months)
  throw new Error("field-cases-results.json: the per-family totals do not add up to the summary");

/** Each case where SSA asked money back: the amount, and whether the same help routed through Giftwise keeps her savings under the limit. */
const askedCases = asked.scored.map((o) => {
  const able = o.routed.find((r) => r.route === "able");
  return { id: o.id, title: o.title, amount: o.amount, period: o.period, monthsOverAsGiven: o.as_given_months_over_limit.length, avoidedThroughAble: Boolean(able?.avoided), needsAbleEligibility: Boolean(able?.needs_able_eligibility) };
});

export const IMPACT = {
  /** Federal court cases scored, and those whose facts allow a benefit-safe route. */
  scoredCases: field.summary.scored,
  routedCases: routed.cases_where_routing_keeps_money,
  /** Scored cases where SSA counted help from family or friends against the person: every one of them. */
  countedCases: field.cases.filter((c) => c.determination.counts).length,
  /** Cases whose opinions state the amounts the check needs, and of those, the ones routing keeps money in if the person can open an ABLE account. */
  computedCases: field.summary.dollars.cases_computed,
  keptIfAbleCases: field.summary.dollars.if_each_person_is_able_eligible.cases_where_routing_keeps_money,
  /** What routing the same help keeps a month in those cases, at 2026 rates, in all. */
  keptMonthly: routed.kept_per_month_2026,
  /** The engine's counterfactual on those cases: the least and most it keeps a month, at 2026 rates, and the years their facts come from. */
  keptMin: Math.min(...keptCases.map((c) => c.kept)),
  keptMax: Math.max(...keptCases.map((c) => c.kept)),
  keptCases,
  keptFromYear: Math.min(...keptYears),
  keptToYear: Math.max(...keptYears),
  /** Per family, over the months each opinion states: the engine's counterfactual, at 2026 rates, smallest first. */
  familyCases,
  familyTotal,
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
 * The court-case claim, the same wherever it is shown: what the cases mean first (help from family was counted against
 * the person in every one), then the engine's counterfactual on them, not an observed outcome. Of the 10 other cases, 6
 * were help with housing or everyday living costs, which routing keeps whole only through ABLE, and 4 do not state the amounts the check needs.
 */
export const COURT_MEANING = `Social Security counted help from family or friends against the person in all ${IMPACT.countedCases} real SSI court cases scored.`;
export const KEPT_SENTENCE = `${COURT_MEANING} Routed through Giftwise, the same help would have kept ${whole(IMPACT.keptMin)} to ${whole(IMPACT.keptMax)} a month at 2026 rates in ${IMPACT.routedCases} of the ${IMPACT.scoredCases} as the opinions state the facts, and money in all ${IMPACT.keptIfAbleCases} whose amounts are stated if the person could open an ABLE account.`;
/** The same claim as a short label under the per-month figure. */
export const KEPT_LABEL = `family help counted against the person in all ${IMPACT.countedCases} real court cases; routed through Giftwise, the same help keeps this in ${IMPACT.routedCases} of them at 2026 rates`;
const COUNT_WORD = ["no", "one", "two", "three", "four", "five", "six"];
/**
 * The lead court-case claim, per family: "In the two real court cases whose opinions state how long the help lasted,
 * the same help routed through Giftwise would have kept one family $13,584.53 over 41 months and another $24,518.79
 * over 37 months, $38,103.32 in all, at 2026 rates."
 */
export const FAMILY_SENTENCE = `In the ${COUNT_WORD[IMPACT.familyCases.length] ?? IMPACT.familyCases.length} real court cases whose opinions state how long the help lasted, the same help routed through Giftwise would have kept ${IMPACT.familyCases
  .map((c, i) => `${i === 0 ? "one family" : "another"} ${dollarsCents(c.total)} over ${c.months} months`)
  .join(" and ")}, ${dollarsCents(IMPACT.familyTotal)} in all, at 2026 rates.`;
/** Where the per-family figures come from. */
export const FAMILY_BASIS = `The rules engine's counterfactual on each case's own facts: what it keeps each month (${IMPACT.familyCases.map((c) => dollarsCents(c.perMonth)).join(" and ")}), repriced at 2026 rates, times the months the opinion states.`;
/** The per-family figures as whole dollars, for a headline: "$13,585 and $24,519". */
export const FAMILY_FIGURE = IMPACT.familyCases.map((c) => whole(c.total)).join(" and ");

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
 * Who each route reaches, measured by the engine on one family-paid rent bill ($800, paid the month of the gift). Paying
 * a shop, a clinic or a school reaches everyone on SSI; rent and utilities stay whole only through an ABLE account, open
 * to people whose disability began before 46. Without ABLE, the presumed maximum value caps how much housing help lowers
 * the check: by the PMV less the $20 general exclusion, $331.33 for a 2026 check and $343 for a 2027 check.
 */
export function housingReach(amount = 800) {
  const profile: Profile = { ...DEFAULT_PROFILE };
  const at = (date: string) => {
    const shop = evaluateGift({ id: "h-shop", date, amount, delivery: "vendor", category: "equipment" }, profile);
    const rentNoAble = evaluateGift({ id: "h-rent", date, amount, delivery: "vendor", category: "rent" }, { ...profile, ableEligible: false });
    const rentAble = evaluateGift({ id: "h-able", date, amount, delivery: "able", category: "rent" }, profile);
    return {
      paymentMonth: shop.paymentMonth,
      full: shop.checkBaseline,
      shop: shop.checkAfter,
      rentWithoutAble: rentNoAble.checkAfter,
      rentThroughAble: rentAble.checkAfter,
      lowered: Math.round((rentNoAble.checkBaseline - rentNoAble.checkAfter) * 100) / 100,
    };
  };
  return { amount, onsetAge: P.ableOnsetAge, years: [at("2026-04-10"), at("2026-11-10")] };
}

/**
 * The sample-year claim: what one shared page keeps against each giver paying alone. "In Maya's sample year, one shared
 * page keeps $1,747.33 that 10 of her monthly checks would lose with each giver paying on their own."
 */
export function sampleYearSentence() {
  const y = payItYourself();
  return `In Maya's sample year, one shared page keeps ${dollarsCents(y.totalLowered)} that ${y.monthsLowered} of her monthly checks would lose with each giver paying on their own.`;
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

/**
 * The part of a real year PayPal carries today, from the same split: everything paid to shops and clinics. The ABLE share
 * goes through the plan's own gift page, and the rest is a jacket given as itself. The README and /about state it.
 */
export function paypalShareSentence() {
  const y = sampleYearSplit();
  const pct = Math.round((y.paypal.amount / y.total) * 100);
  return `PayPal carries ${pct} percent of the sample year's dollars today: ${usd(y.paypal.amount)} of ${usd(y.total)}, everything paid to shops and clinics.`;
}
