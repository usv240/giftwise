import { DEFAULT_PROFILE, P, SHELTER_CATEGORIES, planMonths, type Gift, type Loan, type Profile } from "./rules";

/**
 * Scoring real SSI court cases (content/eval/field-cases.json, field-cases-2.json) on the rules engine: does it reach the
 * outcome SSA and the court did. scripts/run-field-cases.ts records each run; the second class's after-the-fix line is
 * computed here, on the current engine, for /evidence/court-cases.
 */

/** "none": the court held the help is not income at all (the second class, content/eval/field-cases-2.json). */
export type Basis = "ism_vtr" | "ism_pmv" | "ism" | "unearned_cash" | "resources" | "income" | "none";
export type CourtGift = Omit<Gift, "amount"> & { amount: number | null; amount_basis?: string; date_basis?: string };
export type CourtCase = {
  id: string;
  status: string;
  title: string;
  facts?: string;
  profile: Partial<Profile>;
  gifts: CourtGift[];
  determination: { counts: boolean; basis: Basis; values: { month: string; measure: "after_infrequent"; value: number }[]; held: string };
};

const TOLERANCE = 1;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Where the opinion gives no amount for shelter, use SSA's presumed maximum value (20 CFR 416.1140). */
export function toGift(g: CourtGift): Gift {
  if (g.amount === null && !SHELTER_CATEGORIES.includes(g.category)) throw new Error(`${g.id}: no amount and not shelter`);
  return { id: g.id, date: g.date, amount: g.amount ?? P.pmvIndividual, delivery: g.delivery, category: g.category, giver: g.giver, recurring: g.recurring, label: g.label, ...(g.loan ? { loan: g.loan } : {}) };
}

export function courtProfile(c: Pick<CourtCase, "profile">, overrides: Partial<Profile> = {}): Profile {
  return { ...DEFAULT_PROFILE, ableEligible: false, savings: 0, ...c.profile, ...overrides };
}

type PlanMonth = ReturnType<typeof planMonths>["months"][number];
/** Income from the help in a month after the infrequent exclusion, before the $20 general exclusion (as in run-ssa-examples.ts). */
export const afterInfrequent = (m: PlanMonth) => round2(m.cashIncome + m.inKindIncome + m.ismValue - m.infrequentExcluded);

/** What the engine says about the help as it was given, and whether that agrees with what SSA and the court held. */
export function courtAgreement(c: CourtCase) {
  const plan = planMonths(c.gifts.map(toGift), courtProfile(c));
  const bases = new Set<string>();
  for (const g of plan.gifts) if (g.treatment.kind === "unearned_cash") bases.add("unearned_cash");
  for (const m of plan.months) {
    if (m.vtrApplied) bases.add("ism_vtr");
    if (m.ismValue > 0) bases.add("ism_pmv");
    if (m.overResourceLimit) bases.add("resources");
  }
  const counts = plan.months.some((m) => afterInfrequent(m) > 0 || m.vtrApplied || m.overResourceLimit);
  const values = c.determination.values.map((v) => {
    const m = plan.months.find((x) => x.month === v.month);
    return { ...v, got: m ? afterInfrequent(m) : 0 };
  });
  const expected = c.determination.basis;
  const basisOk = expected === "none" ? !counts : expected === "ism" ? bases.has("ism_vtr") || bases.has("ism_pmv") : expected === "income" ? counts : bases.has(expected);
  const countsOk = counts === c.determination.counts;
  const valuesOk = values.every((v) => Math.abs(v.got - v.value) <= TOLERANCE);
  return { plan, counts, bases: [...bases], values, basisOk, countsOk, valuesOk, match: countsOk && basisOk && valuesOk, ruleIds: [...new Set(plan.gifts.flatMap((g) => g.ruleIds))] };
}

/** The court's finding in each case, in the loan field: a bona fide loan, every test met (R-LOAN-01, R-LOAN-02). */
const AS_THE_COURT_FOUND = { mustRepay: true, agreedWhenGiven: true, feasiblePlan: true } as const;

/**
 * The second class after the loan rules were added: each case's help, entered with the loan the court found in the new
 * loan field. The fact is quoted from the case's own text in field-cases-2.json, which stays as it was first run.
 */
export const COURT_2_LOAN_FACTS: Record<string, { fact: string; loan: Loan }> = {
  "son-room-and-board-loan": { fact: "The court of appeals held the agreement was a valid loan", loan: { ...AS_THE_COURT_FOUND, fromHousehold: true } },
  "mother-back-rent-loan": { fact: "The court held the arrangement was a bona fide loan", loan: { ...AS_THE_COURT_FOUND, fromHousehold: true } },
  "attorney-monthly-cash-loan": { fact: "The court held the payments were loans, not gifts", loan: { ...AS_THE_COURT_FOUND } },
};

/**
 * The second class (help a court held was not income) on the current engine: as the file records it, and with the loan
 * each court found in the new loan field. Not a first result: the loan rules were written after these cases were run.
 */
export function courtNotIncomeAfterFix(cases: CourtCase[]) {
  const scored = cases.filter((c) => c.status === "scored");
  const asWritten = scored.map((c) => ({ id: c.id, ...courtAgreement(c) }));
  const withLoans = scored.map((c) => {
    const f = COURT_2_LOAN_FACTS[c.id];
    return { id: c.id, ...courtAgreement(f ? { ...c, gifts: c.gifts.map((g) => ({ ...g, loan: f.loan })) } : c) };
  });
  const tally = (rows: typeof asWritten) => ({ agreed: rows.filter((r) => r.match).length, scored: rows.length });
  return { asWritten: tally(asWritten), withLoans: tally(withLoans), cases: withLoans };
}
