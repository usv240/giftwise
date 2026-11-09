import { P, fbr, pmv, resourceLimit, vtr } from "./params";
import { RULES, sourcesFor } from "./table";
import {
  SHELTER_CATEGORIES,
  type Category,
  type Delivery,
  type Every,
  type Gift,
  type GiftResult,
  type MonthTrace,
  type Profile,
  type Pronoun,
  type ResourceTest,
  type Treatment,
} from "./types";

export const DEFAULT_PROFILE: Profile = {
  couple: false,
  livesInAnothersHousehold: false,
  otherUnearnedMonthly: 0,
  earnedMonthly: 0,
  ableEligible: true,
  ableBalance: 0,
  ableContributedThisYear: 0,
  savings: 1240,
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const isShelter = (c: Category) => SHELTER_CATEGORIES.includes(c);

/** "2026-04-15" -> "2026-04" */
export const monthOf = (date: string) => date.slice(0, 7);

/** The one-third reduction's household test: all month in another's household, which also provides all meals (20 CFR 416.1131(a)). */
export const vtrHousehold = (p: Profile) => p.livesInAnothersHousehold && p.householdProvidesAllMeals !== false;

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function quarterOf(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1];
/** A check's month with its year, "January 2027": the full amount differs by year, so a check is never named without it. */
export const checkMonthName = (month: string) => `${monthName(month)} ${month.slice(0, 4)}`;

export const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });

const CATEGORY_LABEL: Record<Category, string> = {
  medical: "medical care",
  equipment: "equipment",
  phone: "the phone bill",
  internet: "internet",
  education: "school costs",
  utility: "utilities",
  rent: "rent",
  mortgage: "the mortgage",
  property_tax: "property tax",
  food: "food",
  clothing: "clothing",
  transport: "transport",
  personal: "personal items",
  event: "event tickets",
  other: "this need",
};

/** How one gift is treated under the rules, before any month-level arithmetic. */
export function classify(gift: Gift, profile: Profile): Treatment {
  const { delivery, category } = gift;
  if (delivery === "able") {
    if (!profile.ableEligible) {
      return { kind: "not_possible", ruleIds: ["R-ABLE-01"], infrequentEligible: false, ambiguous: false, note: "not_able_eligible" };
    }
    const overLimit = profile.ableContributedThisYear + gift.amount > P.ableAnnualLimit;
    return {
      kind: "excluded",
      ruleIds: isShelter(category) ? ["R-ABLE-01", "R-ABLE-02"] : ["R-ABLE-01"],
      infrequentEligible: false,
      ambiguous: overLimit,
      ambiguityReason: overLimit ? "This would pass the $20,000 yearly ABLE contribution limit." : undefined,
    };
  }
  if (category === "event" && (delivery === "item" || delivery === "vendor")) {
    return { kind: "unearned_in_kind", ruleIds: ["R-ITEM-02", "R-GIE-01", "R-RMA-01"], infrequentEligible: !gift.recurring, ambiguous: false };
  }
  // Housing that reaches her in kind, paid to the landlord or lender or given as itself, is in-kind support either way.
  if ((delivery === "item" || delivery === "vendor") && isShelter(category)) return shelterTreatment(gift, profile);
  if (delivery === "item") {
    return { kind: "excluded", ruleIds: ["R-ITEM-01"], infrequentEligible: false, ambiguous: false };
  }
  if (delivery === "vendor") {
    if (category === "food") return { kind: "excluded", ruleIds: ["R-FOOD-01", "R-VEND-01"], infrequentEligible: false, ambiguous: false };
    if (category === "education") return { kind: "excluded", ruleIds: ["R-VEND-01", "R-EDU-01"], infrequentEligible: false, ambiguous: false };
    return { kind: "excluded", ruleIds: ["R-VEND-01"], infrequentEligible: false, ambiguous: false };
  }
  // cash
  if (category === "education") {
    return { kind: "excluded", ruleIds: ["R-EDU-01"], infrequentEligible: false, ambiguous: false, note: "keep_receipts" };
  }
  return {
    kind: "unearned_cash",
    ruleIds: gift.recurring ? ["R-CASH-01", "R-GIE-01", "R-RMA-01"] : ["R-CASH-01", "R-INFREQ-01", "R-GIE-01", "R-RMA-01"],
    infrequentEligible: !gift.recurring,
    ambiguous: false,
  };
}

/**
 * Housing paid to the landlord or lender (vendor) or given as itself (item), under the rule that values it:
 *   R-SHEL-01  housing costs paid by someone else, up to the presumed maximum value;
 *   R-SHEL-03  a home or other shelter given as itself, counted in the month received (POMS SI 00835.400 B.2.c,
 *              SI 00835.310 B, SI 00815.550 C.2);
 *   R-SHEL-05  rent below market from a parent or child, the rental subsidy (POMS SI 00835.380 D);
 *   R-SHEL-VTR in place of all three when she lives in another's household that also provides all meals.
 * With `covers`, the months a bill puts value in follow R-SHEL-02, or R-SHEL-04 when the payer co-owns the home.
 */
function shelterTreatment(gift: Gift, profile: Profile): Treatment {
  const asItself = gift.delivery === "item";
  // The rental subsidy is developed only where the one-third reduction does not apply (SI 00835.380 B).
  const subsidy = isRentalSubsidy(gift) && !vtrHousehold(profile);
  const rule = subsidy ? "R-SHEL-05" : asItself ? "R-SHEL-03" : "R-SHEL-01";
  const base = vtrHousehold(profile) ? (asItself ? ["R-SHEL-03", "R-SHEL-VTR"] : ["R-SHEL-VTR"]) : [rule, "R-GIE-01"];
  const timing = gift.covers && gift.delivery === "vendor" ? [coOwnerCovers(gift) ? "R-SHEL-04" : "R-SHEL-02"] : [];
  const weekly = paidByTheWeek(gift) ? ["R-SHEL-06"] : [];
  const shared = !vtrHousehold(profile) && sharedWithHousehold(gift) && householdShare(profile) < 1 ? ["R-SHEL-07"] : [];
  const reason = subsidy
    ? "Rent below market from a parent or child counts as in-kind support. SSA asks the landlord for the rent and the market rent."
    : coOwnerCovers(gift)
      ? "A co-owner's payment counts as in-kind support in each month it covers."
      : asItself && gift.category === "mortgage"
        ? "A home counts this way when it is lived in. A home given outright and not lived in counts at its full value instead."
        : asItself
          ? "Housing given as itself counts as in-kind support."
          : gift.category === "utility"
            ? "Utilities paid by someone else count as housing support. Two reviewers check whether this bill is a utility."
            : "Housing paid by someone else counts as in-kind support.";
  return {
    kind: "ism_shelter",
    ruleIds: [...base, ...timing, ...weekly, ...shared],
    // A bill that puts value in more than one month is received in consecutive months, so it is not infrequent (SI 00810.410A.1).
    // Nor is a bill paid every week or two.
    infrequentEligible: !gift.recurring && !paidByTheWeek(gift) && !coversLaterMonths(gift) && !(coOwnerCovers(gift) && monthsBetween(gift.covers!.from, gift.covers!.to) > 1),
    ambiguous: true,
    ambiguityReason: reason,
  };
}

/** Rent below market from a landlord who is her parent or child, entered as the market rent less the rent she pays. */
export const isRentalSubsidy = (g: Gift) => g.category === "rent" && typeof g.rentPaid === "number" && (g.delivery === "vendor" || g.delivery === "item");

/**
 * The rental subsidy in a month: the lesser of the market rent and the presumed maximum value, less the rent she pays,
 * and none once her rent reaches either (POMS SI 00835.380 A.2 and D.1; 89 FR 25507). `difference` is the market rent
 * less her rent, the gift as entered.
 */
export function rentalSubsidy(difference: number, rentPaid: number, cap: number): number {
  return round2(Math.max(0, Math.min(difference + rentPaid, cap) - rentPaid));
}

/** Weekly amounts to monthly: times 13, divided by 3; a two-week amount is halved first (POMS SI 00835.474 B.3). */
export const PER_MONTH: Record<Every, number> = { week: 13 / 3, two_weeks: 13 / 6 };

/** True when a housing bill paid to the landlord or company is entered by the week or every two weeks (R-SHEL-06). */
export const paidByTheWeek = (g: Gift) => Boolean(g.every && PER_MONTH[g.every] && !g.covers && g.delivery === "vendor" && isShelter(g.category) && !isRentalSubsidy(g));

/**
 * Her share of housing paid from outside the household for all of it: one member's equal share, times two for a couple
 * (POMS SI 00835.350 B.4 and C; a rental subsidy, SI 00835.380 D.1.d). 1 when no one else lives with her (R-SHEL-07).
 */
export function householdShare(p: Profile): number {
  const members = p.couple ? 2 : 1;
  const size = Math.max(members, Math.floor(Number(p.householdSize) || 0));
  return members / size;
}

/** Housing paid to the landlord or company serves the whole household; a home or other shelter given as itself serves only her. */
const sharedWithHousehold = (g: Gift) => isShelter(g.category) && (g.delivery === "vendor" || isRentalSubsidy(g));

const monthsBetween = (from: string, to: string) => {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
};

/** True when a housing bill covers months after the month it was paid. */
export const coversLaterMonths = (g: Gift) => Boolean(g.covers && g.covers.to > monthOf(g.date));

/** True when a co-owner of the home pays a housing bill that covers stated months (POMS SI 00835.360 D.3). */
export const coOwnerCovers = (g: Gift) => Boolean(g.payerCoOwns && g.covers && g.delivery === "vendor" && isShelter(g.category));

/**
 * The months other than the payment month a gift can put value in: a bill's later months (R-SHEL-02), or every month
 * a co-owner's payment covers, earlier ones included (R-SHEL-04).
 */
export function otherMonths(g: Gift): string[] {
  if (!g.covers || !(coOwnerCovers(g) || coversLaterMonths(g))) return [];
  const paid = monthOf(g.date);
  const out: string[] = [];
  for (let m = coOwnerCovers(g) ? g.covers.from : addMonths(paid, 1); m <= g.covers.to; m = addMonths(m, 1)) if (m !== paid) out.push(m);
  return out;
}

/**
 * The part of a gift that counts in a month. A housing bill paid for past, current and future months counts its
 * share for every month up to the payment month in the payment month, and each later month's share in that month
 * (POMS SI 00835.360B and D.2). A co-owner's payment is not a gift, so each month's share counts in that month, past
 * months included (SI 00835.360 D.3, SI 00835.310 B). Everything else counts in full in the month it is given.
 */
export function amountInMonth(g: Gift, month: string): number {
  const paid = monthOf(g.date);
  if (!g.covers || g.delivery !== "vendor" || !isShelter(g.category)) return paid === month ? g.amount : 0;
  const { from, to } = g.covers;
  const share = g.amount / monthsBetween(from, to);
  if (coOwnerCovers(g)) return month >= from && month <= to ? share : 0;
  if (month === paid) return monthsBetween(from, paid < to ? paid : to) * share * (paid >= from ? 1 : 0);
  return month > paid && month >= from && month <= to ? share : 0;
}

/**
 * Each gift's part of a month. A housing bill paid weekly or every two weeks counts its converted monthly amount
 * (R-SHEL-06, POMS SI 00835.474 B.3): the payments one giver makes toward one bill in the month are one weekly amount,
 * their average, times 13 divided by 3, shared among those payments. Four Mondays of $25 rent count $108.33, as five
 * would. Everything else is amountInMonth().
 */
export function monthShares(gifts: Gift[], month: string): Map<Gift, number> {
  const out = new Map<Gift, number>();
  const weekly = new Map<string, Gift[]>();
  for (const g of gifts) {
    if (!paidByTheWeek(g)) out.set(g, amountInMonth(g, month));
    else if (monthOf(g.date) === month) {
      const key = `${g.giver ?? ""}|${g.category}|${g.every}`;
      weekly.set(key, [...(weekly.get(key) ?? []), g]);
    } else out.set(g, 0);
  }
  for (const gs of weekly.values()) {
    const monthly = round2((gs.reduce((s, g) => s + g.amount, 0) / gs.length) * PER_MONTH[gs[0].every!]);
    for (const g of gs) out.set(g, monthly / gs.length);
  }
  return out;
}

/** ABLE deposits among these gifts made before the 1st of `month`, so in the account that day. */
export function ableDepositsBefore(gifts: Gift[], month: string, profile: Profile): number {
  if (!profile.ableEligible) return 0;
  return round2(gifts.filter((g) => g.delivery === "able" && monthOf(g.date) < month).reduce((s, g) => s + g.amount, 0));
}

/**
 * Countable resources on the 1st of `month` (R-RES-01, POMS SI 01110.003): the savings she states plus `otherAdded`,
 * and the part of her ABLE balance, with `ableDeposits` added, over $100,000 (R-ABLE-03, SI 01130.740 D.1). Over the
 * limit because of the ABLE balance, SSI cash is suspended and Medicaid continues; over it on her other resources
 * alone, she is not eligible that month. Either way no SSI is paid for the month. A check, not a ledger: the inputs are
 * the balances the caller states.
 */
export function resourceTest(profile: Profile, month: string, ableDeposits = 0, otherAdded = 0): ResourceTest {
  const ableBalance = round2((profile.ableBalance ?? 0) + ableDeposits);
  const ableExcess = round2(Math.max(0, ableBalance - P.ableResourceExclusion));
  const other = round2((profile.savings ?? 0) + otherAdded);
  const countable = round2(other + ableExcess);
  const limit = resourceLimit(profile.couple);
  const over = countable > limit;
  return { on: `${month}-01`, other, ableBalance, ableExcess, countable, limit, over, status: !over ? "under" : other > limit ? "excess" : "able_suspension" };
}

/**
 * Countable income and the resulting check for one income month.
 * quarterAllowanceUsed: infrequent exclusion already used earlier in the same calendar quarter.
 *
 * The $60 one-off allowance applies in the order income arrives, and to housing help at its actual value before the
 * monthly cap (POMS SI 00810.410L.3): a $500 mortgage payment then a $25 cash gift leaves $440 of housing help, capped,
 * and the $25 counted in full.
 */
export function computeMonth(month: string, gifts: Gift[], profile: Profile, quarterAllowanceUsed = 0): MonthTrace {
  const couple = profile.couple;
  const payMonth = addMonths(month, P.rmaLagMonths);
  const cap = pmv(couple, payMonth);
  let cashIncome = 0;
  let inKind = 0;
  let shelterPaid = 0;
  const items: { date: string; amount: number; shelter: boolean; infrequent: boolean }[] = [];
  const shares = monthShares(gifts, month);
  const share = householdShare(profile);

  for (const g of gifts) {
    const inMonth = shares.get(g) ?? 0;
    if (inMonth <= 0) continue;
    const t = classify(g, profile);
    // A rental subsidy is valued against the presumed maximum value for this month's check (R-SHEL-05).
    const value = t.ruleIds.includes("R-SHEL-05") ? rentalSubsidy(inMonth, g.rentPaid!, cap) : inMonth;
    // Housing paid from outside the household is divided among its members, before the cap (R-SHEL-07).
    const amount = t.kind === "ism_shelter" && sharedWithHousehold(g) ? value * share : value;
    if (amount <= 0) continue;
    if (t.kind === "unearned_cash") cashIncome += amount;
    else if (t.kind === "unearned_in_kind") inKind += amount;
    else if (t.kind === "ism_shelter") shelterPaid += amount;
    else continue;
    items.push({ date: g.date, amount, shelter: t.kind === "ism_shelter", infrequent: t.infrequentEligible });
  }

  const vtrApplied = vtrHousehold(profile) && shelterPaid > 0;
  const ismValue = shelterPaid > 0 && !vtrApplied ? Math.min(shelterPaid, cap) : 0;

  // No exclusion applies to the one-third reduction (SI 00835.200A.6), so housing help under it takes none of the allowance.
  let allowance = Math.max(0, P.infrequentUnearnedPerQuarter - quarterAllowanceUsed);
  let otherExcluded = 0;
  let shelterExcluded = 0;
  for (const it of [...items].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!it.infrequent || allowance <= 0 || (it.shelter && vtrApplied)) continue;
    const x = Math.min(allowance, it.amount);
    allowance -= x;
    if (it.shelter) shelterExcluded += x;
    else otherExcluded += x;
  }
  const ismCounted = ismValue > 0 ? Math.min(shelterPaid - shelterExcluded, cap) : 0;
  const infrequentUsed = otherExcluded + shelterExcluded;
  const infrequentExcluded = otherExcluded + (ismValue - ismCounted);

  // Rounded to the cent here so the order the amounts were added in can never move the check by a cent.
  const unearnedBeforeGie = round2(Math.max(0, cashIncome + inKind + ismValue + profile.otherUnearnedMonthly - infrequentExcluded));
  const generalExcludedFromUnearned = Math.min(P.generalIncomeExclusion, unearnedBeforeGie);
  const gieLeft = P.generalIncomeExclusion - generalExcludedFromUnearned;
  const generalExcludedFromEarned = Math.min(gieLeft, profile.earnedMonthly);
  const earnedCountable = Math.max(0, profile.earnedMonthly - generalExcludedFromEarned - P.earnedIncomeExclusion) / 2;

  const vtrCounted = vtrApplied ? vtr(couple, payMonth) : 0;
  const countableIncome = round2(unearnedBeforeGie - generalExcludedFromUnearned + earnedCountable + vtrCounted);
  const incomeCheck = round2(Math.max(0, fbr(couple, payMonth) - countableIncome));
  // Eligibility for the month a check is paid turns on resources on its 1st (R-RES-01); ABLE deposits stay in the account.
  const resources = resourceTest(profile, payMonth, ableDepositsBefore(gifts, payMonth, profile));
  const check = resources.over ? 0 : incomeCheck;

  return {
    month,
    cashIncome: round2(cashIncome),
    inKindIncome: round2(inKind),
    shelterPaidByOthers: round2(shelterPaid),
    ismValue: round2(ismValue),
    vtrApplied,
    infrequentExcluded: round2(infrequentExcluded),
    infrequentUsed: round2(infrequentUsed),
    generalExcludedFromUnearned: round2(generalExcludedFromUnearned),
    generalExcludedFromEarned: round2(generalExcludedFromEarned),
    earnedCountable: round2(earnedCountable),
    otherUnearned: profile.otherUnearnedMonthly,
    countableIncome,
    incomeCheck,
    resources,
    check,
    paymentMonth: payMonth,
  };
}

const ROUTE_ORDER: Delivery[] = ["vendor", "item", "able", "cash"];

/** A home given outright, entered as an item in the mortgage category: the home itself is the gift (R-SHEL-03). */
export const isHomeGiven = (g: Gift) => g.delivery === "item" && g.category === "mortgage";

function routesFor(gift: Gift, profile: Profile) {
  return ROUTE_ORDER.map((delivery) => {
    const alt: Gift = { ...gift, delivery };
    const t = classify(alt, profile);
    if (t.kind === "not_possible") {
      return { delivery, check: 0, possible: false, reason: t.note };
    }
    // A home given as itself has no other way to arrive: it is not money that could be paid to a shop or an ABLE account.
    if (isHomeGiven(gift) && delivery !== "item") {
      return { delivery, check: 0, possible: false, reason: "a_home_is_given_as_itself" };
    }
    // Housing given as itself is a route only for the gift that arrived that way; a housing bill is not an item to give.
    if (delivery === "item" && isShelter(gift.category) && gift.delivery !== "item") {
      return { delivery, check: 0, possible: false, reason: "shelter_is_not_an_item" };
    }
    const asGiven = delivery === "item" && gift.delivery === "item" && isShelter(gift.category);
    if (delivery === "item" && !asGiven && !["equipment", "personal", "clothing", "medical", "education", "other", "phone", "internet", "transport", "event"].includes(gift.category)) {
      return { delivery, check: 0, possible: false, reason: "no_item_for_category" };
    }
    if (delivery === "vendor" && gift.category === "other") {
      return { delivery, check: 0, possible: false, reason: "no_vendor_known" };
    }
    const tr = computeMonth(monthOf(gift.date), [alt], profile);
    // An ABLE deposit that takes the account past $100,000 and her resources past the limit stops the check (R-ABLE-03).
    const overLimit = delivery === "able" && tr.resources.over && !resourceTest(profile, tr.paymentMonth).over;
    return { delivery, check: tr.check, possible: true as boolean, reason: overLimit ? "able_over_resource_limit" : (undefined as string | undefined) };
  });
}

/** Evaluate a single gift: how it is treated, what it does to the check, and the best way to deliver it. */
export function evaluateGift(gift: Gift, profile: Profile = DEFAULT_PROFILE): GiftResult {
  const treatment = classify(gift, profile);
  const month = monthOf(gift.date);
  const baseline = computeMonth(month, [], profile);
  const trace = computeMonth(month, treatment.kind === "not_possible" ? [] : [gift], profile);
  const countedAmount = round2(trace.countableIncome - baseline.countableIncome);

  const alternatives = routesFor(gift, profile);
  const possible = alternatives.filter((a) => a.possible);
  const best = possible.reduce((a, b) => (b.check > a.check ? b : a), possible[0] ?? { delivery: gift.delivery, check: trace.check, possible: true });

  // On the 1st of next month: cash she keeps adds to her savings, and an ABLE deposit is in the account (R-RES-01, R-ABLE-03).
  const nextFirst = addMonths(month, 1);
  const retainedCash = treatment.kind === "unearned_cash" ? gift.amount : 0;
  const ableIn = treatment.kind !== "not_possible" && gift.delivery === "able" ? gift.amount : 0;
  const resourcesBefore = resourceTest(profile, nextFirst);
  const resourcesAfter = resourceTest(profile, nextFirst, ableIn, retainedCash);
  const resourcesNextFirst = resourcesAfter.countable;
  const overResourceLimit = resourcesAfter.over;

  const ruleIds = [...treatment.ruleIds];
  if (resourcesAfter.ableExcess > 0) ruleIds.push("R-ABLE-03");
  if (overResourceLimit || trace.resources.over) ruleIds.push("R-RES-01");

  return {
    gift,
    treatment,
    ruleIds,
    sourceKeys: sourcesFor(ruleIds),
    incomeMonth: month,
    paymentMonth: trace.paymentMonth,
    countedAmount,
    checkBaseline: baseline.check,
    checkAfter: trace.check,
    bestRoute: best.delivery,
    checkWithBestRoute: best.check,
    resourcesNextFirst,
    overResourceLimit,
    resourcesBefore,
    resourcesAfter,
    ambiguous: treatment.ambiguous,
    ambiguityReason: treatment.ambiguityReason,
    explanation: explain(gift, profile, treatment, trace, baseline, best.delivery, best.check, countedAmount, resourcesBefore, resourcesAfter),
    trace,
    alternatives,
  };
}

/** Plan a whole month (or several) of gifts, applying the quarterly exclusion across them in date order. */
export function planMonths(gifts: Gift[], profile: Profile = DEFAULT_PROFILE) {
  const covered = gifts.flatMap(otherMonths);
  const months = [...new Set([...gifts.map((g) => monthOf(g.date)), ...covered])].sort();
  const withInfrequency = markInfrequency(gifts);
  const usedByQuarter = new Map<string, number>();
  let savings = profile.savings;
  const result = months.map((month) => {
    const q = quarterOf(month);
    const used = usedByQuarter.get(q) ?? 0;
    // The check's resource test uses the balances she states and the ABLE deposits; cash she may keep is the warning below.
    const trace = computeMonth(month, withInfrequency, profile, used);
    usedByQuarter.set(q, used + trace.infrequentUsed);
    const cashKept = withInfrequency
      .filter((g) => monthOf(g.date) === month && classify(g, profile).kind === "unearned_cash")
      .reduce((s, g) => s + g.amount, 0);
    savings = round2(savings + cashKept);
    // On the 1st of next month, if she keeps the cash: savings, and the part of her ABLE account over $100,000.
    const next = addMonths(month, 1);
    const over = resourceTest(profile, next, ableDepositsBefore(withInfrequency, next, profile), round2(savings - profile.savings)).over;
    return { ...trace, savingsOnNextFirst: savings, overResourceLimit: over };
  });
  return { months: result, gifts: withInfrequency.map((g) => evaluateGift(g, profile)) };
}

/** A gift is infrequent when the same giver gives no other gift in the same quarter or the months either side. */
export function markInfrequency(gifts: Gift[]): Gift[] {
  return gifts.map((g) => {
    if (g.recurring) return g;
    const m = monthOf(g.date);
    const near = new Set([addMonths(m, -1), m, addMonths(m, 1)]);
    const q = quarterOf(m);
    const others = gifts.filter(
      (o) => o !== g && o.giver && o.giver === g.giver && (near.has(monthOf(o.date)) || quarterOf(monthOf(o.date)) === q),
    );
    return others.length > 0 ? { ...g, recurring: true } : g;
  });
}

function explain(
  gift: Gift,
  profile: Profile,
  t: Treatment,
  trace: MonthTrace,
  baseline: MonthTrace,
  best: Delivery,
  bestCheck: number,
  counted: number,
  before: ResourceTest,
  after: ResourceTest,
): { plain: string; technical: string } {
  // The check is named with its month and year, so its amount reads against the right year's federal rate
  // ($994 in 2026, $1,029 from January 2027): "her January 2027 check".
  const pay = checkMonthName(trace.paymentMonth);
  const inc = monthName(trace.month);
  const full = usd(baseline.check);
  const label = CATEGORY_LABEL[gift.category];
  const w = pronounWords(profile.pronoun);
  let plain: string;

  if (t.kind === "not_possible") {
    // The one gift the engine cannot place is an ABLE deposit for someone who cannot have an account.
    plain = "An ABLE account is for people whose disability began before age 46. Another route will work better here.";
  } else if (t.kind === "unearned_cash") {
    const excl = round2(trace.infrequentExcluded + trace.generalExcludedFromUnearned);
    plain = `Cash counts as income. ${usd(gift.amount)} minus ${usd(excl)} in exclusions leaves ${usd(counted)} counted in ${inc}, so ${w.poss} ${pay} check would be ${usd(trace.check)}.`;
    if (bestCheck > trace.check) plain += ` ${routePhrase(best, w)} keeps ${w.poss} ${pay} check at ${usd(bestCheck)}.`;
    if (after.over && !before.over) plain += ` Kept as cash, ${w.poss} savings would be ${usd(after.countable)} on the 1st, over the limit.`;
  } else if (t.kind === "unearned_in_kind") {
    const excl = round2(trace.infrequentExcluded + trace.generalExcludedFromUnearned);
    plain = `Tickets ${w.subj} receives count as income at their value, even when bought straight from the box office. ${usd(gift.amount)} minus ${usd(excl)} in exclusions leaves ${usd(counted)} counted in ${inc}, so ${w.poss} ${pay} check would be ${usd(trace.check)}.`;
    if (bestCheck > trace.check) plain += ` ${routePhrase(best, w)} keeps ${w.poss} ${pay} check at ${usd(bestCheck)}.`;
  } else if (t.kind === "ism_shelter") {
    const cap = usd(pmv(profile.couple, trace.paymentMonth));
    const result = `${usd(counted)} would be counted in ${inc}, so ${w.poss} ${pay} check would be ${usd(trace.check)}.`;
    if (trace.vtrApplied) {
      plain = `Because ${w.subj} ${w.lives} in someone else's home, help with ${label} lowers ${w.poss} ${pay} check by a fixed ${usd(vtr(profile.couple, trace.paymentMonth))}, to ${usd(trace.check)}.`;
    } else if (t.ruleIds.includes("R-SHEL-05")) {
      const rent = gift.rentPaid ?? 0;
      plain =
        rent >= pmv(profile.couple, trace.paymentMonth)
          ? `Rent of ${usd(rent)} a month to a parent or child is at or above ${cap}, so no rental subsidy is counted. ${w.Poss} ${pay} check stays ${usd(trace.check)}.`
          : `Rent below market from a parent or child counts as a rental subsidy: the lesser of the market rent and ${cap}, less the ${usd(rent)} rent paid. ${result}`;
    } else if (t.ruleIds.includes("R-SHEL-04")) {
      plain = `A co-owner's payment is not a gift, so each month it covers counts in that month, up to ${cap} a month. ${result}`;
    } else if (isHomeGiven(gift)) {
      plain = `A home given outright counts as housing support in the month it is given, valued at no more than ${cap}, and not in the months after. ${result}`;
    } else {
      plain = `Help with ${label} counts as housing support, up to ${cap} a month. ${usd(counted)} would be counted, so ${w.poss} ${pay} check would be ${usd(trace.check)}.`;
    }
    if (bestCheck > trace.check) plain += ` ${routePhrase(best, w)} keeps ${w.poss} ${pay} check at ${usd(bestCheck)}.`;
  } else if (t.ruleIds.includes("R-FOOD-01")) {
    plain = `Food paid for by others has not been counted since September 30, 2024. ${w.Poss} ${pay} check stays ${usd(trace.check)}.`;
  } else if (t.ruleIds.includes("R-EDU-01")) {
    plain = `A gift used for tuition, books or school supplies is not counted. ${w.Poss} ${pay} check stays ${usd(trace.check)}. Keep the receipts.`;
  } else if (t.ruleIds.includes("R-ABLE-01") && after.ableExcess > before.ableExcess) {
    // The deposit takes the account past $100,000: the part over counts toward her savings (R-ABLE-03).
    plain =
      `A gift to ${w.poss} ABLE account is not counted as income, but only the first $100,000 in the account stays out of ${w.poss} savings. ` +
      `This gift takes it to ${usd(after.ableBalance)}, so ${usd(after.ableExcess)} counts toward ${w.poss} savings, ${usd(after.countable)} in all on ${firstOf(after.on)}. ` +
      (!after.over ? `That is within the ${usd(after.limit)} limit, so ${w.poss} ${pay} check stays ${usd(trace.check)}.` : before.over ? "" : overLimitSentence(after, w, pay));
    if (bestCheck > trace.check) plain += ` ${routePhrase(best, w)} keeps ${w.poss} ${pay} check at ${usd(bestCheck)}.`;
    if (t.ambiguous && t.ambiguityReason) plain += ` ${t.ambiguityReason}`;
  } else if (t.ruleIds.includes("R-ABLE-01")) {
    plain = `A gift to ${w.poss} ABLE account is not counted, and the first $100,000 in it does not count toward savings. ${w.Poss} ${pay} check stays ${usd(trace.check)}.`;
    if (t.ambiguous && t.ambiguityReason) plain += ` ${t.ambiguityReason}`;
  } else if (t.ruleIds.includes("R-ITEM-01")) {
    plain = `A gift of the item itself is not counted as income. ${w.Poss} ${pay} check stays ${usd(trace.check)}.`;
  } else {
    plain = `Paid straight to the shop, so it is not counted. ${w.Poss} ${pay} check stays ${full}.`;
  }
  // Resources already over the limit on the balances she states: no SSI is paid whatever the gift (R-RES-01).
  if (before.over) {
    const parts = before.ableExcess > 0 ? `: ${usd(before.other)} in savings and ${usd(before.ableExcess)}, the part of ${w.poss} ABLE account over $100,000` : "";
    plain += ` ${w.Poss} countable resources on ${firstOf(before.on)} are ${usd(before.countable)}${parts}. ${overLimitWhy(before)}.`;
  }

  const rules = t.ruleIds.map((id) => `${id} (${RULES[id]?.name})`).join("; ");
  const technical =
    `Rules ${rules}. Income month ${trace.month}, payment month ${trace.paymentMonth} (retrospective monthly accounting, lag ${P.rmaLagMonths}). ` +
    `Cash ${usd(trace.cashIncome)}; in kind ${usd(trace.inKindIncome)}; shelter paid by others ${usd(trace.shelterPaidByOthers)}; ISM value ${usd(trace.ismValue)}${trace.vtrApplied ? " (VTR)" : ""}; ` +
    `infrequent exclusion ${usd(trace.infrequentExcluded)}; general exclusion ${usd(trace.generalExcludedFromUnearned)}; countable ${usd(trace.countableIncome)}; ` +
    `FBR for ${pay} ${usd(fbr(profile.couple, trace.paymentMonth))} gives ${usd(trace.incomeCheck)}. ` +
    `Resources on ${trace.resources.on} ${usd(trace.resources.countable)} (other ${usd(trace.resources.other)}, ABLE over $100,000 ${usd(trace.resources.ableExcess)}) against ${usd(trace.resources.limit)}: ${trace.resources.status}, check ${usd(trace.check)}. ` +
    `Best route: ${best} (${usd(bestCheck)} in ${pay}).`;

  return { plain, technical };
}

/** "December 1, 2026", from "2026-12-01". */
const firstOf = (day: string) => `${monthName(day.slice(0, 7))} 1, ${day.slice(0, 4)}`;

/**
 * Why a check is $0 when countable resources are over the limit: over only because of the ABLE account, SSI cash stops
 * and Medicaid continues (POMS SI 01130.740 D.1.c); over on other resources, no SSI is paid (SI 01110.003, D.1.b).
 */
function overLimitWhy(r: ResourceTest) {
  return r.status === "able_suspension"
    ? `That is over the ${usd(r.limit)} limit because of the ABLE account, so SSI cash stops while it stays over, and Medicaid continues`
    : `That is over the ${usd(r.limit)} limit, so no SSI is paid while it stays over`;
}
const overLimitSentence = (r: ResourceTest, w: ReturnType<typeof pronounWords>, pay: string) => `${overLimitWhy(r)}: ${w.poss} ${pay} check would be $0.`;

/** she/her, he/him or they/them, for the explanations. */
export function pronounWords(p: Pronoun = "she") {
  const poss = p === "he" ? "his" : p === "they" ? "their" : "her";
  return { subj: p, poss, Poss: poss[0].toUpperCase() + poss.slice(1), lives: p === "they" ? "live" : "lives" };
}

function routePhrase(d: Delivery, w = pronounWords()) {
  switch (d) {
    case "vendor":
      return "Paying the shop directly";
    case "item":
      return "Giving the item itself";
    case "able":
      return `Sending it to ${w.poss} ABLE account`;
    default:
      return "Giving cash";
  }
}
