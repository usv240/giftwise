import type { Gift, Profile } from "./rules";

/**
 * Score SSA's held-out worked examples (content/eval/held-out.json) on a rules engine: the frozen copy the runner loads
 * from git (scripts/run-held-out.ts), or the current one (tests/held-out.test.ts). The measures are the main set's
 * (scripts/run-ssa-examples.ts): income after the infrequent exclusion, in-kind support, and the SSI amount a month gives.
 */
type Measure = "after_infrequent" | "ism_value" | "ssi_amount";
export type HeldOutCase = {
  id: string;
  title: string;
  cite: string;
  url: string;
  part: string;
  profile?: Partial<Profile>;
  gifts: Gift[];
  expected: { counts: boolean; values: { month: string; measure: Measure; value: number }[] };
  ssa_answer: string;
};
type Month = { month: string; check: number; cashIncome: number; inKindIncome: number; ismValue: number; infrequentExcluded: number; vtrApplied: boolean };
type Engine = {
  DEFAULT_PROFILE: Profile;
  planMonths: (gifts: Gift[], profile: Profile) => { months: Month[]; gifts: { ruleIds: string[] }[] };
  computeMonth: (month: string, gifts: Gift[], profile: Profile) => { check: number; vtrApplied?: boolean };
};

const TOLERANCE = 1;

export function scoreHeldOut(cases: HeldOutCase[], engine: Engine) {
  return cases.map((c) => {
    const profile: Profile = { ...engine.DEFAULT_PROFILE, ableEligible: true, savings: 0, ...c.profile };
    const plan = engine.planMonths(c.gifts, profile);
    const byMonth = new Map(plan.months.map((m) => [m.month, m]));
    const read = (month: string, measure: Measure) => {
      const t = byMonth.get(month);
      if (measure === "ssi_amount") return t?.check ?? engine.computeMonth(month, [], profile).check;
      if (!t) return 0;
      if (measure === "ism_value") return t.ismValue;
      return Math.round((t.cashIncome + t.inKindIncome + t.ismValue - t.infrequentExcluded) * 100) / 100;
    };
    const values = c.expected.values.map((v) => ({ ...v, got: read(v.month, v.measure), match: Math.abs(read(v.month, v.measure) - v.value) <= TOLERANCE }));
    // SSA counts the one-third reduction as income too (20 CFR 416.1131), so a month under it counts. A month the case
    // scores with no payment in it (help from inside the household, set by the profile alone) is read the same way.
    const quiet = c.expected.values.map((v) => v.month).filter((m) => !byMonth.has(m));
    const counts = plan.months.some((m) => m.cashIncome + m.inKindIncome + m.ismValue - m.infrequentExcluded > 0 || m.vtrApplied) || quiet.some((m) => engine.computeMonth(m, [], profile).vtrApplied === true);
    const countsMatch = counts === c.expected.counts;
    return {
      id: c.id,
      title: c.title,
      cite: c.cite,
      part: c.part,
      url: c.url,
      ssa_answer: c.ssa_answer,
      expected_counts: c.expected.counts,
      engine_counts: counts,
      counts_match: countsMatch,
      values,
      rule_ids: [...new Set(plan.gifts.flatMap((g) => g.ruleIds))],
      match: countsMatch && values.every((v) => v.match),
    };
  });
}

/**
 * The second set (content/eval/held-out-2.json) after the three housing rules it showed were added: R-SHEL-03 (a home
 * given as itself), R-SHEL-04 (a co-owner's payment) and R-SHEL-05 (rent below market from a parent or child). This is
 * not a held-out result, because the rules were written after seeing these five; the held-out result stays the frozen
 * run in held-out-2-results.json. Two cases turn on a fact the engine had no field for when the set was written, so
 * they are scored twice: as written, and with that fact, quoted from the case's own situation, in the new field.
 */
export const HELD_OUT_2_NEW_FIELDS: Record<string, { fact: string; fields: Partial<Gift>; profile?: Partial<Profile> }> = {
  "co-owner-mortgage": { fact: "a house he owns jointly with his sibling", fields: { payerCoOwns: true } },
  "rent-below-market-from-child": { fact: "paying the required rent of $280 a month", fields: { rentPaid: 280 } },
};

type NewFields = Record<string, { fact: string; fields?: Partial<Gift>; profile?: Partial<Profile> }>;

/** A set scored as written, and again with each new field's fact, quoted from the case's own situation, in the field. */
function afterFix(cases: HeldOutCase[], engine: Engine, extra: NewFields) {
  const asWritten = scoreHeldOut(cases, engine);
  const withFields = scoreHeldOut(
    cases.map((c) => {
      const e = extra[c.id];
      return e ? { ...c, profile: { ...c.profile, ...e.profile }, gifts: c.gifts.map((g) => ({ ...g, ...e.fields })) } : c;
    }),
    engine,
  );
  const tally = (s: ReturnType<typeof scoreHeldOut>) => ({ matches: s.filter((c) => c.match).length, cases: s.length, misses: s.filter((c) => !c.match).map((c) => c.id) });
  return { asWritten: tally(asWritten), withFields: tally(withFields), newFields: Object.keys(extra), cases: withFields };
}

export function heldOut2AfterFix(cases: HeldOutCase[], engine: Engine) {
  return afterFix(cases, engine, HELD_OUT_2_NEW_FIELDS);
}

/**
 * The third set (content/eval/held-out-3.json) after the rules it showed were added: R-SHEL-06 (a housing bill paid by
 * the week, converted to a monthly amount), R-SHEL-07 (housing help divided among the household) and R-ABLE-03 with
 * R-RES-01 (an ABLE balance over $100,000 counted toward savings, and no SSI over the limit). Not a held-out result: the
 * rules were written after seeing these five, and the held-out result stays the frozen run in held-out-3-results.json.
 * Two cases turn on a fact the engine had no field for when the set was written, so they are scored twice, as with the
 * second set. The two ABLE cases already state the balances in fields the engine had (ableBalance, savings).
 */
export const HELD_OUT_3_NEW_FIELDS: NewFields = {
  "weekly-rent-from-sibling": { fact: "the rent is $25 a week", fields: { every: "week" } },
  "property-tax-partly-past-with-roommate": { fact: "lives with her sister", profile: { householdSize: 2 } },
};

export function heldOut3AfterFix(cases: HeldOutCase[], engine: Engine) {
  return afterFix(cases, engine, HELD_OUT_3_NEW_FIELDS);
}

/** A loan that meets every one of SSA's tests, as the case states it: "a bona fide loan agreement". */
const BONA_FIDE = { mustRepay: true, agreedWhenGiven: true, feasiblePlan: true } as const;

/**
 * The fourth set (content/eval/held-out-4.json) after the rules it showed were added: R-SHEL-08 (the household's own
 * shelter counts every month, gift or not, unless she pays her pro rata share of its costs, within $20) and R-LOAN-01
 * with R-LOAN-02 (a bona fide loan is not income; a loan of housing counts only for what she need not repay). Not a
 * held-out result: the rules were written after seeing these fifteen, and the held-out result stays the frozen run in
 * held-out-4-results.json. Where a case states the loan or the household's costs and what the person pays, that fact,
 * quoted from the case's own situation, goes in the new field; the three loans SSA found were not loans need none,
 * because the household's shelter now counts from the profile alone. Every share is the household's shelter costs only:
 * food has not been one of them since September 30, 2024, so Kathleen's $75 for food is not part of what she pays.
 */
export const HELD_OUT_4_NEW_FIELDS: NewFields = {
  "loan-outside-utility-repaid": { fact: "under a bona fide loan agreement: she agreed to repay the whole $150", fields: { loan: { ...BONA_FIDE } } },
  "loan-outside-utility-share-of-two": { fact: "under a bona fide loan agreement: she agreed to repay her share, $75", fields: { loan: { ...BONA_FIDE, repay: 75 } } },
  "loan-ended-contribution-short": { fact: "he pays $300 a month toward his $400 pro rata share", profile: { livesInAnothersHousehold: true, proRataShare: 400, householdPays: 300 } },
  "cash-for-household-share-met": { fact: "John's own $200 and Mabel's $100 cover his $300 share", profile: { livesInAnothersHousehold: true, proRataShare: 300, householdPays: 300 } },
  "cash-for-household-share-short": { fact: "he pays $200 in April 2026 toward his $300 share of the household's $600 costs", profile: { livesInAnothersHousehold: true, householdCosts: 600, householdPays: 200 } },
  "sharing-short-by-20": { fact: "The household's costs are $450 a month, so Grayson's share is $150, and in April 2026 he pays $100", profile: { livesInAnothersHousehold: true, householdCosts: 450, householdPays: 100 } },
  "sharing-over-by-20": { fact: "Grayson pays $175 a month toward his $150 share", profile: { livesInAnothersHousehold: true, proRataShare: 150, householdPays: 175 } },
  "sharing-within-20": { fact: "the household's costs are $435 a month, so Grayson's share is $145, and Grayson pays $125", profile: { livesInAnothersHousehold: true, householdCosts: 435, householdPays: 125 } },
  "earmarked-food-short": { fact: "$75 for food and $75 for shelter. The household spends $450 a month on food and $600 on shelter", profile: { livesInAnothersHousehold: true, householdCosts: 600, householdPays: 75 } },
};

export function heldOut4AfterFix(cases: HeldOutCase[], engine: Engine) {
  return afterFix(cases, engine, HELD_OUT_4_NEW_FIELDS);
}
