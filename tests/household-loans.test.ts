import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE, RULES, computeMonth, evaluateGift, householdTest, loanFailures, planMonths, type Gift, type Loan, type Profile } from "@/lib/rules";

/**
 * R-SHEL-08 (a share of another person's household), R-LOAN-01 (cash lent) and R-LOAN-02 (food or shelter lent), each
 * from the facts of SSA's own examples. Income in April 2026 sets the June 2026 check: $994, less $331.33 under the
 * one-third reduction, $662.67.
 */
const april = (p: Partial<Profile>, gifts: Gift[] = []) => computeMonth("2026-04", gifts, { ...DEFAULT_PROFILE, savings: 0, ...p });
const g = (over: Partial<Gift>): Gift => ({ id: "t", date: "2026-04-10", amount: 150, delivery: "vendor", category: "utility", ...over });
const BONA_FIDE: Loan = { mustRepay: true, agreedWhenGiven: true, feasiblePlan: true };
const inAnothers = { livesInAnothersHousehold: true } as const;

describe("R-SHEL-08: paying a share of another person's household (20 CFR 416.1133; POMS SI 00835.160, .170, .450)", () => {
  it("is in the rule table with its sources", () => {
    expect(RULES["R-SHEL-08"].sourceKeys).toEqual(expect.arrayContaining(["cfr-416-1133", "poms-si-00835-160", "poms-si-00835-170", "poms-si-00835-450"]));
  });

  it("living in another's household and paying nothing, the one-third reduction applies every month, with no gift at all", () => {
    const m = april(inAnothers);
    expect([m.vtrApplied, m.check]).toEqual([true, 662.67]);
    expect(m.household).toMatchObject({ share: null, pays: 0, sharing: false, rule: "vtr" });
  });

  it("SI 00835.160 G, Example 1: Grayson pays $100 of a $150 share ($450 for three), so the reduction applies", () => {
    expect(april({ ...inAnothers, householdSize: 3, householdCosts: 450, householdPays: 100 })).toMatchObject({ check: 662.67, household: { share: 150, pays: 100, rule: "vtr" } });
  });

  it("Example 2: paying $175 toward $150 is sharing; Example 3: $125 toward a verified $145 share is within $20, sharing too", () => {
    expect(april({ ...inAnothers, householdSize: 3, householdCosts: 450, householdPays: 175 })).toMatchObject({ check: 994, vtrApplied: false, household: { sharing: true, rule: "none" } });
    expect(april({ ...inAnothers, householdSize: 3, householdCosts: 435, householdPays: 125 })).toMatchObject({ check: 994, household: { share: 145, sharing: true } });
    // A cent more than $20 short is not within the tolerance.
    expect(april({ ...inAnothers, householdSize: 3, householdCosts: 435, householdPays: 124.99 }).check).toBe(662.67);
  });

  it("SI 00835.450 G: Mabel's $100 is cash income either way; John's $300 meets his share, $200 does not and adds the reduction", () => {
    const mabel = g({ amount: 100, delivery: "cash", category: "other", giver: "sister", recurring: true });
    expect(april({ ...inAnothers, householdSize: 2, householdCosts: 600, householdPays: 300 }, [mabel]).check).toBe(914);
    expect(april({ ...inAnothers, householdSize: 2, householdCosts: 600, householdPays: 200 }, [mabel]).check).toBe(582.67);
  });

  it("SI 00835.482 E.4: Alfred's stated $400 share and $300 paid: the reduction applies", () => {
    expect(april({ ...inAnothers, proRataShare: 400, householdPays: 300 }).check).toBe(662.67);
  });

  it("SI 00835.170 C.4: Kathleen's $75 for shelter against a $120 share; food is not a household cost since 2024, so her $75 for food is not part of what she pays", () => {
    const kathleen = { ...inAnothers, householdSize: 5, householdCosts: 600, householdPays: 75 };
    expect(april(kathleen)).toMatchObject({ check: 662.67, household: { share: 120, pays: 75, rule: "vtr" } });
    // Food paid for by others is not counted at all (R-FOOD-01): a grocery gift adds nothing, and nothing is counted twice.
    const food = g({ amount: 90, category: "food" });
    expect(april(kathleen, [food]).check).toBe(662.67);
    expect(evaluateGift(food, { ...DEFAULT_PROFILE, ...kathleen }).countedAmount).toBe(0);
  });

  it("SI 00835.200 A.3: with the reduction, an outside payment of the electric bill adds nothing, and the reduction counts once", () => {
    const r = evaluateGift(g({ amount: 100, recurring: true }), { ...DEFAULT_PROFILE, ...inAnothers });
    expect([r.checkBaseline, r.checkAfter, r.countedAmount, r.trace.ismValue]).toEqual([662.67, 662.67, 0, 0]);
    expect(r.ruleIds).toEqual(["R-SHEL-VTR", "R-SHEL-08"]);
    expect(april(inAnothers, [g({ amount: 100 }), g({ id: "u", amount: 300, category: "rent" })]).countableIncome).toBe(331.33);
  });

  it("not all meals from the household: its shelter counts under the presumed maximum value, her share less what she pays (SI 00835.340 C.3)", () => {
    const own = { ...inAnothers, householdProvidesAllMeals: false, householdSize: 3, householdCosts: 450, householdPays: 50 };
    expect(april(own)).toMatchObject({ vtrApplied: false, ismValue: 100, check: 914, household: { rule: "pmv", value: 100 } });
    // Rent paid from outside for the household of three is divided among them, $100 each (R-SHEL-07); with the household's
    // own $100 it is $200. Both share one cap (SI 00835.340 B.6): $900 of rent takes the total past it.
    expect(april(own, [g({ amount: 300, category: "rent", recurring: true })]).ismValue).toBe(200);
    expect(april(own, [g({ amount: 900, category: "rent", recurring: true })]).ismValue).toBe(351.33);
    // Her share not known: the presumed maximum value (20 CFR 416.1140).
    expect(april({ ...inAnothers, householdProvidesAllMeals: false })).toMatchObject({ ismValue: 351.33, check: 662.67 });
  });

  it("a couple's share is both members' together, and the $20 applies to it (SI 00835.160 C.2)", () => {
    expect(householdTest({ ...DEFAULT_PROFILE, ...inAnothers, couple: true, householdSize: 4, householdCosts: 600, householdPays: 285 })).toMatchObject({ share: 300, sharing: true });
    expect(householdTest({ ...DEFAULT_PROFILE, ...inAnothers, couple: true, householdSize: 4, householdCosts: 600, householdPays: 270 })?.rule).toBe("vtr");
  });

  it("every answer says the household already lowers the check, and what paying her share would change", () => {
    const r = evaluateGift(g({ category: "equipment", amount: 420 }), { ...DEFAULT_PROFILE, ...inAnothers, householdSize: 3, householdCosts: 450, householdPays: 100 });
    expect(r.checkAfter).toBe(r.checkBaseline);
    expect(r.explanation.plain).toContain(
      "She lives in someone else's household and pays $100 of her $150 share of its costs, so her June 2026 check is already reduced by a third, $331.33, gift or not. Paying at least $130 a month toward the household's costs would end that.",
    );
    // Living on her own, nothing changes.
    expect(evaluateGift(g({ category: "equipment", amount: 420 }), DEFAULT_PROFILE).explanation.plain).not.toContain("household");
  });
});

describe("R-LOAN-01: cash lent, not given (20 CFR 416.1103(f), POMS SI 01120.220)", () => {
  it("a bona fide cash loan is not income, and repaying it later does not lower her countable income", () => {
    const r = evaluateGift(g({ amount: 900, delivery: "cash", category: "other", loan: BONA_FIDE }), { ...DEFAULT_PROFILE, savings: 0 });
    expect([r.countedAmount, r.checkAfter, r.treatment.kind]).toEqual([0, 994, "excluded"]);
    expect(r.ruleIds).toEqual(["R-LOAN-01"]);
    expect(r.explanation.plain).toContain("Paying it back later does not lower her countable income");
  });

  it("cash lent and kept into the next month counts toward savings (SI 01120.220 C.1.a)", () => {
    const r = evaluateGift(g({ amount: 900, delivery: "cash", category: "other", loan: BONA_FIDE }), { ...DEFAULT_PROFILE, savings: 1240 });
    expect([r.resourcesNextFirst, r.overResourceLimit]).toEqual([2140, true]);
    expect(planMonths([g({ amount: 900, delivery: "cash", category: "other", loan: BONA_FIDE })], { ...DEFAULT_PROFILE, savings: 1240 }).months[0].overResourceLimit).toBe(true);
  });

  it("SI 01120.220 D.3: $200 a month the child says need not be repaid is no loan; it counts as cash", () => {
    const r = evaluateGift(g({ amount: 200, delivery: "cash", category: "other", recurring: true, loan: { ...BONA_FIDE, mustRepay: false } }), { ...DEFAULT_PROFILE, savings: 0 });
    expect([r.countedAmount, r.checkAfter]).toEqual([180, 814]);
    expect(r.ruleIds).toEqual(expect.arrayContaining(["R-CASH-01", "R-LOAN-01"]));
    expect(r.explanation.plain).toMatch(/^SSA would not treat this as a loan, because repaying depends on a condition/);
  });

  it("each test SSA names is checked, and an ABLE deposit is never a loan", () => {
    expect(loanFailures(BONA_FIDE)).toEqual([]);
    expect(loanFailures({ mustRepay: false, agreedWhenGiven: false, feasiblePlan: false, enforceable: false })).toHaveLength(4);
    expect(evaluateGift(g({ amount: 500, delivery: "able", category: "other", loan: BONA_FIDE }), DEFAULT_PROFILE).ruleIds).toEqual(["R-ABLE-01"]);
  });
});

describe("R-LOAN-02: food or shelter lent, not given (POMS SI 00835.482)", () => {
  it("B.4 and G.4.c: a $150 utility bill paid as a loan she repays in full counts nothing", () => {
    const r = evaluateGift(g({ loan: BONA_FIDE }), { ...DEFAULT_PROFILE, savings: 0 });
    expect([r.trace.ismValue, r.checkAfter]).toEqual([0, 994]);
    expect(r.ruleIds).toContain("R-LOAN-02");
  });

  it("G.4.a and G.4.c: in a household of two she owes her $75 share; repaying $75 leaves nothing counted", () => {
    expect(april({ householdSize: 2 }, [g({ loan: { ...BONA_FIDE, repay: 75 } })]).ismValue).toBe(0);
  });

  it("G.4.a and G.4.d: valued as if there were no loan, less what she must repay: $300 for three is $100; repaying $40 leaves $60", () => {
    expect(april({ householdSize: 3 }, [g({ amount: 300 })]).ismValue).toBe(100);
    expect(april({ householdSize: 3 }, [g({ amount: 300, loan: { ...BONA_FIDE, repay: 40 } })]).ismValue).toBe(60);
  });

  it("F.4, Example 1: the household's shelter lent for her share counts as her share paid, so nothing counts", () => {
    const lent = g({ amount: 351.33, category: "rent", recurring: true, giver: "sibling", loan: { ...BONA_FIDE, fromHousehold: true } });
    const m = april(inAnothers, [lent]);
    expect([m.vtrApplied, m.check, m.household?.sharing]).toEqual([false, 994, true]);
    // With a stated share, the loan counts with what she pays: $250 lent and $100 paid meets a $350 share.
    expect(april({ ...inAnothers, proRataShare: 350, householdPays: 100 }, [{ ...lent, amount: 250 }]).check).toBe(994);
    expect(april({ ...inAnothers, proRataShare: 350, householdPays: 50 }, [{ ...lent, amount: 250 }]).check).toBe(662.67);
  });

  it("B.3, Examples 1 and 2, and B.5, Example 2: no mutual agreement, a conditional repayment or a plan she cannot meet is no loan, so the reduction applies", () => {
    for (const loan of [
      { ...BONA_FIDE, agreedWhenGiven: false, fromHousehold: true },
      { ...BONA_FIDE, mustRepay: false, fromHousehold: true },
      { ...BONA_FIDE, feasiblePlan: false, fromHousehold: true },
    ]) {
      const r = evaluateGift(g({ amount: 351.33, category: "rent", recurring: true, loan }), { ...DEFAULT_PROFILE, ...inAnothers, savings: 0 });
      expect([r.checkAfter, r.trace.vtrApplied]).toEqual([662.67, true]);
      expect(r.explanation.plain).toMatch(/^SSA would not treat this as a loan/);
    }
  });
});
