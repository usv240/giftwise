import { P, fbr, pmv, resourceLimit, vtr } from "./params";
import { RULES, sourcesFor } from "./table";
import {
  SHELTER_CATEGORIES,
  type Category,
  type Delivery,
  type Gift,
  type GiftResult,
  type MonthTrace,
  type Profile,
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
  if (delivery === "item") {
    if (isShelter(category)) {
      return { kind: "not_possible", ruleIds: ["R-SHEL-01"], infrequentEligible: false, ambiguous: false, note: "shelter_is_not_an_item" };
    }
    return { kind: "excluded", ruleIds: ["R-ITEM-01"], infrequentEligible: false, ambiguous: false };
  }
  if (delivery === "vendor") {
    if (isShelter(category)) {
      return {
        kind: "ism_shelter",
        ruleIds: profile.livesInAnothersHousehold ? ["R-SHEL-VTR"] : ["R-SHEL-01", "R-GIE-01"],
        infrequentEligible: !gift.recurring,
        ambiguous: true,
        ambiguityReason:
          category === "utility"
            ? "Utilities paid by someone else count as housing support. Two reviewers check whether this bill is a utility."
            : "Housing paid by someone else counts as in-kind support.",
      };
    }
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
 * Countable income and the resulting check for one income month.
 * quarterAllowanceUsed: infrequent exclusion already used earlier in the same calendar quarter.
 */
export function computeMonth(month: string, gifts: Gift[], profile: Profile, quarterAllowanceUsed = 0): MonthTrace {
  const couple = profile.couple;
  let cashIncome = 0;
  let cashInfrequent = 0;
  let shelterPaid = 0;
  let shelterInfrequent = true;

  for (const g of gifts) {
    if (monthOf(g.date) !== month) continue;
    const t = classify(g, profile);
    if (t.kind === "unearned_cash") {
      cashIncome += g.amount;
      if (t.infrequentEligible) cashInfrequent += g.amount;
    } else if (t.kind === "ism_shelter") {
      shelterPaid += g.amount;
      if (!t.infrequentEligible) shelterInfrequent = false;
    }
  }

  const vtrApplied = profile.livesInAnothersHousehold && shelterPaid > 0;
  const ismValue = shelterPaid > 0 && !vtrApplied ? Math.min(shelterPaid, pmv(couple)) : 0;

  const allowanceLeft = Math.max(0, P.infrequentUnearnedPerQuarter - quarterAllowanceUsed);
  const infrequentBase = cashInfrequent + (ismValue > 0 && shelterInfrequent ? ismValue : 0);
  const infrequentExcluded = Math.min(allowanceLeft, infrequentBase);

  const unearnedBeforeGie = Math.max(0, cashIncome + ismValue + profile.otherUnearnedMonthly - infrequentExcluded);
  const generalExcludedFromUnearned = Math.min(P.generalIncomeExclusion, unearnedBeforeGie);
  const gieLeft = P.generalIncomeExclusion - generalExcludedFromUnearned;
  const generalExcludedFromEarned = Math.min(gieLeft, profile.earnedMonthly);
  const earnedCountable = Math.max(0, profile.earnedMonthly - generalExcludedFromEarned - P.earnedIncomeExclusion) / 2;

  const vtrCounted = vtrApplied ? vtr(couple) : 0;
  const countableIncome = round2(unearnedBeforeGie - generalExcludedFromUnearned + earnedCountable + vtrCounted);
  const check = round2(Math.max(0, fbr(couple) - countableIncome));

  return {
    month,
    cashIncome: round2(cashIncome),
    shelterPaidByOthers: round2(shelterPaid),
    ismValue: round2(ismValue),
    vtrApplied,
    infrequentExcluded: round2(infrequentExcluded),
    generalExcludedFromUnearned: round2(generalExcludedFromUnearned),
    generalExcludedFromEarned: round2(generalExcludedFromEarned),
    earnedCountable: round2(earnedCountable),
    otherUnearned: profile.otherUnearnedMonthly,
    countableIncome,
    check,
    paymentMonth: addMonths(month, P.rmaLagMonths),
  };
}

const ROUTE_ORDER: Delivery[] = ["vendor", "item", "able", "cash"];

function routesFor(gift: Gift, profile: Profile) {
  return ROUTE_ORDER.map((delivery) => {
    const alt: Gift = { ...gift, delivery };
    const t = classify(alt, profile);
    if (t.kind === "not_possible") {
      return { delivery, check: 0, possible: false, reason: t.note };
    }
    if (delivery === "item" && !["equipment", "personal", "clothing", "medical", "education", "other", "phone", "internet", "transport"].includes(gift.category)) {
      return { delivery, check: 0, possible: false, reason: "no_item_for_category" };
    }
    if (delivery === "vendor" && gift.category === "other") {
      return { delivery, check: 0, possible: false, reason: "no_vendor_known" };
    }
    const tr = computeMonth(monthOf(gift.date), [alt], profile);
    return { delivery, check: tr.check, possible: true as boolean, reason: undefined as string | undefined };
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

  const retainedCash = treatment.kind === "unearned_cash" ? gift.amount : 0;
  const resourcesNextFirst = round2(profile.savings + retainedCash);
  const overResourceLimit = resourcesNextFirst > resourceLimit(profile.couple);

  const ruleIds = [...treatment.ruleIds];
  if (overResourceLimit) ruleIds.push("R-RES-01");

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
    ambiguous: treatment.ambiguous,
    ambiguityReason: treatment.ambiguityReason,
    explanation: explain(gift, profile, treatment, trace, baseline, best.delivery, best.check, countedAmount, resourcesNextFirst, overResourceLimit),
    trace,
    alternatives,
  };
}

/** Plan a whole month (or several) of gifts, applying the quarterly exclusion across them in date order. */
export function planMonths(gifts: Gift[], profile: Profile = DEFAULT_PROFILE) {
  const months = [...new Set(gifts.map((g) => monthOf(g.date)))].sort();
  const withInfrequency = markInfrequency(gifts);
  const usedByQuarter = new Map<string, number>();
  let savings = profile.savings;
  const result = months.map((month) => {
    const q = quarterOf(month);
    const used = usedByQuarter.get(q) ?? 0;
    const trace = computeMonth(month, withInfrequency, { ...profile, savings }, used);
    usedByQuarter.set(q, used + trace.infrequentExcluded);
    const cashKept = withInfrequency
      .filter((g) => monthOf(g.date) === month && classify(g, profile).kind === "unearned_cash")
      .reduce((s, g) => s + g.amount, 0);
    savings = round2(savings + cashKept);
    return { ...trace, savingsOnNextFirst: savings, overResourceLimit: savings > resourceLimit(profile.couple) };
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
  resourcesNextFirst: number,
  overLimit: boolean,
): { plain: string; technical: string } {
  const pay = monthName(trace.paymentMonth);
  const inc = monthName(trace.month);
  const full = usd(baseline.check);
  const label = CATEGORY_LABEL[gift.category];
  let plain: string;

  if (t.kind === "not_possible") {
    plain =
      t.note === "not_able_eligible"
        ? "An ABLE account is for people whose disability began before age 46. Another route will work better here."
        : "Housing is paid as a bill, not given as an item. Try paying the bill through her ABLE account.";
  } else if (t.kind === "unearned_cash") {
    const excl = round2(trace.infrequentExcluded + trace.generalExcludedFromUnearned);
    plain = `Cash counts as income. ${usd(gift.amount)} minus ${usd(excl)} in exclusions leaves ${usd(counted)} counted in ${inc}, so her ${pay} check would be ${usd(trace.check)}.`;
    if (bestCheck > trace.check) plain += ` ${routePhrase(best)} keeps ${usd(bestCheck)}.`;
    if (overLimit) plain += ` Kept as cash, her savings would be ${usd(resourcesNextFirst)} on the 1st, over the limit.`;
  } else if (t.kind === "ism_shelter") {
    plain = trace.vtrApplied
      ? `Because she lives in someone else's home, help with ${label} lowers her ${pay} check by a fixed ${usd(vtr(profile.couple))}, to ${usd(trace.check)}.`
      : `Help with ${label} counts as housing support, up to ${usd(pmv(profile.couple))} a month. ${usd(counted)} would be counted, so her ${pay} check would be ${usd(trace.check)}.`;
    if (bestCheck > trace.check) plain += ` ${routePhrase(best)} keeps ${usd(bestCheck)}.`;
  } else if (t.ruleIds.includes("R-FOOD-01")) {
    plain = `Food paid for by others has not been counted since September 30, 2024. Her ${pay} check stays ${usd(trace.check)}.`;
  } else if (t.ruleIds.includes("R-EDU-01")) {
    plain = `A gift used for tuition, books or school supplies is not counted. Her ${pay} check stays ${usd(trace.check)}. Keep the receipts.`;
  } else if (t.ruleIds.includes("R-ABLE-01")) {
    plain = `A gift to her ABLE account is not counted, and the first $100,000 in it does not count toward savings. Her ${pay} check stays ${usd(trace.check)}.`;
    if (t.ambiguous && t.ambiguityReason) plain += ` ${t.ambiguityReason}`;
  } else if (t.ruleIds.includes("R-ITEM-01")) {
    plain = `A gift of the item itself is not counted as income. Her ${pay} check stays ${usd(trace.check)}.`;
  } else {
    plain = `Paid straight to the shop, so it is not counted. Her ${pay} check stays ${full}.`;
  }

  const rules = t.ruleIds.map((id) => `${id} (${RULES[id]?.name})`).join("; ");
  const technical =
    `Rules ${rules}. Income month ${trace.month}, payment month ${trace.paymentMonth} (retrospective monthly accounting, lag ${P.rmaLagMonths}). ` +
    `Cash ${usd(trace.cashIncome)}; shelter paid by others ${usd(trace.shelterPaidByOthers)}; ISM value ${usd(trace.ismValue)}${trace.vtrApplied ? " (VTR)" : ""}; ` +
    `infrequent exclusion ${usd(trace.infrequentExcluded)}; general exclusion ${usd(trace.generalExcludedFromUnearned)}; countable ${usd(trace.countableIncome)}; ` +
    `FBR ${usd(fbr(profile.couple))} gives ${usd(trace.check)}. Best route: ${best} (${usd(bestCheck)}).`;

  return { plain, technical };
}

function routePhrase(d: Delivery) {
  switch (d) {
    case "vendor":
      return "Paying the shop directly";
    case "item":
      return "Giving the item itself";
    case "able":
      return "Sending it to her ABLE account";
    default:
      return "Giving cash";
  }
}
