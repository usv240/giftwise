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
  computeMonth: (month: string, gifts: Gift[], profile: Profile) => { check: number };
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
    // SSA counts the one-third reduction as income too (20 CFR 416.1131), so a month under it counts.
    const counts = plan.months.some((m) => m.cashIncome + m.inKindIncome + m.ismValue - m.infrequentExcluded > 0 || m.vtrApplied);
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
export const HELD_OUT_2_NEW_FIELDS: Record<string, { fact: string; fields: Partial<Gift> }> = {
  "co-owner-mortgage": { fact: "a house he owns jointly with his sibling", fields: { payerCoOwns: true } },
  "rent-below-market-from-child": { fact: "paying the required rent of $280 a month", fields: { rentPaid: 280 } },
};

export function heldOut2AfterFix(cases: HeldOutCase[], engine: Engine) {
  const asWritten = scoreHeldOut(cases, engine);
  const withFields = scoreHeldOut(
    cases.map((c) => {
      const extra = HELD_OUT_2_NEW_FIELDS[c.id];
      return extra ? { ...c, gifts: c.gifts.map((g) => ({ ...g, ...extra.fields })) } : c;
    }),
    engine,
  );
  const tally = (s: ReturnType<typeof scoreHeldOut>) => ({ matches: s.filter((c) => c.match).length, cases: s.length, misses: s.filter((c) => !c.match).map((c) => c.id) });
  return { asWritten: tally(asWritten), withFields: tally(withFields), newFields: Object.keys(HELD_OUT_2_NEW_FIELDS), cases: withFields };
}
