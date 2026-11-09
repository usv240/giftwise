import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE, RULES, computeMonth, evaluateGift, markInfrequency, planMonths, rentalSubsidy, type Gift, type Profile } from "@/lib/rules";

const base: Profile = { ...DEFAULT_PROFILE, savings: 1240 };
const g = (over: Partial<Gift>): Gift => ({ id: "t", date: "2026-04-10", amount: 1000, delivery: "cash", category: "other", ...over });

describe("pronouns in explanations", () => {
  it("uses their for they/them, and never changes the math", () => {
    const g = { id: "p", date: "2026-11-10", amount: 420, delivery: "vendor" as const, category: "equipment" as const };
    const they = evaluateGift(g, { ...DEFAULT_PROFILE, pronoun: "they" });
    const she = evaluateGift(g, DEFAULT_PROFILE);
    expect(they.explanation.plain).toMatch(/Their \w+ 2027 check stays/);
    expect(they.explanation.plain).not.toMatch(/\bher\b/i);
    expect(she.explanation.plain).toMatch(/Her \w+ 2027 check stays/);
    expect(they.checkAfter).toBe(she.checkAfter);
  });
});

describe("hero numbers", () => {
  it("R-CASH-01, R-INFREQ-01, R-GIE-01: a one-off $1,000 cash gift leaves $920 counted and a $74 check", () => {
    const r = evaluateGift(g({}), base);
    expect(r.countedAmount).toBe(920);
    expect(r.checkAfter).toBe(74);
    expect(r.ruleIds).toEqual(expect.arrayContaining(["R-CASH-01", "R-INFREQ-01", "R-GIE-01"]));
  });

  it("R-RMA-01: income in April changes the June check", () => {
    const r = evaluateGift(g({}), base);
    expect(r.incomeMonth).toBe("2026-04");
    expect(r.paymentMonth).toBe("2026-06");
  });

  it("R-VEND-01: paying the shop directly keeps the full $994", () => {
    const r = evaluateGift(g({ delivery: "vendor", category: "equipment", amount: 420 }), base);
    expect(r.checkAfter).toBe(994);
    expect(r.countedAmount).toBe(0);
    expect(r.ruleIds).toContain("R-VEND-01");
  });

  it("R-SHEL-01: family paying $800 rent every month leaves a $662.67 check", () => {
    const r = evaluateGift(g({ delivery: "vendor", category: "rent", amount: 800, recurring: true }), base);
    expect(r.countedAmount).toBe(331.33);
    expect(r.checkAfter).toBe(662.67);
    expect(r.ambiguous).toBe(true);
    expect(r.bestRoute).toBe("able");
    expect(r.checkWithBestRoute).toBe(994);
  });

  it("R-SHEL-01 with R-INFREQ-01: a one-off rent payment gets the $60 exclusion before the cap (POMS SI 00810.410L.3)", () => {
    // $800 less $60 is $740, still above the $351.33 cap, so the full cap counts: 994 - (351.33 - 20).
    expect(evaluateGift(g({ delivery: "vendor", category: "rent", amount: 800 }), base).checkAfter).toBe(662.67);
    // Below the cap the exclusion still lowers what counts: $150 less $60 is $90, then the $20 general exclusion.
    expect(evaluateGift(g({ delivery: "vendor", category: "rent", amount: 150 }), base).checkAfter).toBe(924);
  });

  it("R-ABLE-01, R-ABLE-02: rent money sent to ABLE keeps $994", () => {
    const r = evaluateGift(g({ delivery: "able", category: "rent", amount: 800 }), base);
    expect(r.checkAfter).toBe(994);
    expect(r.ruleIds).toEqual(expect.arrayContaining(["R-ABLE-01", "R-ABLE-02"]));
  });
});

describe("presets", () => {
  it("birthday cash $300: $220 counted, $774 check, the item route keeps $994", () => {
    const r = evaluateGift(g({ amount: 300 }), base);
    expect(r.checkAfter).toBe(774);
    expect(r.bestRoute).toBe("item");
    expect(r.checkWithBestRoute).toBe(994);
  });

  it("electric bill $138 paid every month: $118 counted, $876 check, flagged for two reviewers", () => {
    const r = evaluateGift(g({ delivery: "vendor", category: "utility", amount: 138, recurring: true }), base);
    expect(r.checkAfter).toBe(876);
    expect(r.ambiguous).toBe(true);
    expect(r.ambiguityReason).toMatch(/Utilities/);
    expect(r.bestRoute).toBe("able");
  });

  it("R-FOOD-01: groceries paid by a friend are not counted", () => {
    const r = evaluateGift(g({ delivery: "vendor", category: "food", amount: 150 }), base);
    expect(r.checkAfter).toBe(994);
    expect(r.ruleIds).toContain("R-FOOD-01");
  });

  it("R-EDU-01: a laptop for college paid to the bookstore is not counted", () => {
    const r = evaluateGift(g({ delivery: "vendor", category: "education", amount: 649 }), base);
    expect(r.checkAfter).toBe(994);
    expect(r.ruleIds).toEqual(expect.arrayContaining(["R-VEND-01", "R-EDU-01"]));
  });

  it("R-EDU-01: cash given for tuition is excluded", () => {
    const r = evaluateGift(g({ delivery: "cash", category: "education", amount: 649 }), base);
    expect(r.checkAfter).toBe(994);
    expect(r.treatment.note).toBe("keep_receipts");
  });

  it("R-ITEM-01: giving the item itself is not counted", () => {
    const r = evaluateGift(g({ delivery: "item", category: "personal", amount: 289 }), base);
    expect(r.checkAfter).toBe(994);
    expect(r.ruleIds).toContain("R-ITEM-01");
  });
});

describe("edge cases", () => {
  it("ABLE is not offered when she is not eligible", () => {
    const r = evaluateGift(g({ delivery: "able", category: "rent", amount: 800 }), { ...base, ableEligible: false });
    expect(r.treatment.kind).toBe("not_possible");
    expect(r.alternatives.find((a) => a.delivery === "able")?.possible).toBe(false);
  });

  it("ABLE contributions past $20,000 a year are flagged", () => {
    const r = evaluateGift(g({ delivery: "able", category: "other", amount: 1000 }), { ...base, ableContributedThisYear: 19500 });
    expect(r.ambiguous).toBe(true);
  });

  it("R-SHEL-VTR: living in another's household applies the fixed one-third reduction", () => {
    const r = evaluateGift(g({ delivery: "vendor", category: "rent", amount: 500, recurring: true }), { ...base, livesInAnothersHousehold: true });
    expect(r.checkAfter).toBe(662.67);
    expect(r.ruleIds).toContain("R-SHEL-VTR");
  });

  it("R-SHEL-VTR needs the household to provide all meals; buying her own food means the presumed maximum value rule (20 CFR 416.1131(a)(3), found by the court-case run)", () => {
    const r = evaluateGift(g({ delivery: "vendor", category: "rent", amount: 500, recurring: true }), { ...base, livesInAnothersHousehold: true, householdProvidesAllMeals: false });
    expect(r.ruleIds).not.toContain("R-SHEL-VTR");
    expect(r.ruleIds).toContain("R-SHEL-01");
    // $500 of shelter is capped at the presumed maximum value, $351.33, less the $20 general exclusion.
    expect(r.checkAfter).toBe(662.67);
  });

  it("earned income: $20, then $65, then half of the rest", () => {
    const t = computeMonth("2026-04", [], { ...base, earnedMonthly: 500 });
    expect(t.countableIncome).toBe(207.5);
    expect(t.check).toBe(786.5);
  });

  it("couple values use the couple rate", () => {
    const r = evaluateGift(g({}), { ...base, couple: true });
    expect(r.checkAfter).toBe(1491 - 920);
  });

  it("R-RES-01: kept cash pushes savings over $2,000 on the next 1st", () => {
    const r = evaluateGift(g({}), base);
    expect(r.resourcesNextFirst).toBe(2240);
    expect(r.overResourceLimit).toBe(true);
    expect(r.ruleIds).toContain("R-RES-01");
  });
});

describe("month planning", () => {
  it("two gifts from the same giver in a quarter are not infrequent", () => {
    const gifts = markInfrequency([
      g({ id: "a", date: "2026-04-02", amount: 100, giver: "Joe" }),
      g({ id: "b", date: "2026-05-20", amount: 100, giver: "Joe" }),
    ]);
    expect(gifts.every((x) => x.recurring)).toBe(true);
  });

  it("gifts in adjacent months across a quarter boundary are not infrequent", () => {
    const gifts = markInfrequency([
      g({ id: "a", date: "2026-03-30", amount: 50, giver: "Ana" }),
      g({ id: "b", date: "2026-04-02", amount: 50, giver: "Ana" }),
    ]);
    expect(gifts.every((x) => x.recurring)).toBe(true);
  });

  it("the $60 quarterly exclusion is shared across gifts in the same quarter", () => {
    const plan = planMonths([
      g({ id: "a", date: "2026-04-05", amount: 50, giver: "Ana" }),
      g({ id: "b", date: "2026-06-25", amount: 50, giver: "Ben" }),
    ], base);
    const [apr, jun] = plan.months;
    expect(apr.infrequentExcluded).toBe(50);
    expect(jun.infrequentExcluded).toBe(10);
  });
});

describe("R-INFREQ-01: order of receipt and the housing cap (POMS SI 00810.410L.3)", () => {
  const profile = { ...base, savings: 0 };
  it("a $500 mortgage payment first takes the whole $60, so the $25 cash after it counts in full", () => {
    const [sep] = planMonths([
      g({ id: "m", date: "2026-09-02", amount: 500, delivery: "vendor", category: "mortgage", giver: "sister" }),
      g({ id: "c", date: "2026-09-15", amount: 25, giver: "friend" }),
    ], profile).months;
    expect(sep.ismValue).toBe(351.33);
    expect(sep.infrequentUsed).toBe(60);
    expect(sep.infrequentExcluded).toBe(0);
    expect(sep.cashIncome + sep.ismValue - sep.infrequentExcluded).toBe(376.33);
  });
  it("with the $25 cash first, it is excluded and $35 is left for the mortgage, which is still over the cap", () => {
    const [sep] = planMonths([
      g({ id: "c", date: "2026-09-02", amount: 25, giver: "friend" }),
      g({ id: "m", date: "2026-09-15", amount: 500, delivery: "vendor", category: "mortgage", giver: "sister" }),
    ], profile).months;
    expect(sep.infrequentUsed).toBe(60);
    expect(sep.cashIncome + sep.ismValue - sep.infrequentExcluded).toBe(351.33);
  });
});

describe("R-SHEL-02: housing bills paid ahead (POMS SI 00835.360B, D.2)", () => {
  const profile = { ...base, savings: 0 };
  it("an $800 property tax bill for January to December, paid June 30, counts six months in June and $66.67 a month after", () => {
    const plan = planMonths([g({ date: "2026-06-30", amount: 800, delivery: "vendor", category: "property_tax", covers: { from: "2026-01", to: "2026-12" } })], profile);
    const at = (m: string) => plan.months.find((x) => x.month === m)!;
    expect(plan.months.map((m) => m.month)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]);
    expect(at("2026-06").shelterPaidByOthers).toBe(400);
    expect(at("2026-06").ismValue).toBe(351.33);
    expect(at("2026-07").ismValue).toBe(66.67);
    expect(at("2026-12").ismValue).toBe(66.67);
    expect(at("2026-06").infrequentExcluded).toBe(0);
    expect(evaluateGift(g({ date: "2026-06-30", amount: 800, delivery: "vendor", category: "property_tax", covers: { from: "2026-01", to: "2026-12" } }), profile).ruleIds).toContain("R-SHEL-02");
  });
  it("next month's rent paid this month counts next month", () => {
    const plan = planMonths([g({ date: "2026-03-25", amount: 300, delivery: "vendor", category: "rent", covers: { from: "2026-04", to: "2026-04" } })], profile);
    expect(plan.months.find((m) => m.month === "2026-03")!.ismValue).toBe(0);
    expect(plan.months.find((m) => m.month === "2026-04")!.ismValue).toBe(300);
  });
  it("a bill with no covered months still counts in the month it is paid", () => {
    const [m] = planMonths([g({ date: "2026-05-10", amount: 300, delivery: "vendor", category: "rent", recurring: true })], profile).months;
    expect(m.month).toBe("2026-05");
    expect(m.ismValue).toBe(300);
  });
});

describe("R-SHEL-03: housing given as itself (POMS SI 00835.400 B.2.c and F, SI 00835.310 B, SI 00815.550 C.2)", () => {
  const profile = { ...base, savings: 0 };
  const home = (over: Partial<Gift> = {}) => g({ date: "2026-06-15", amount: 40000, delivery: "item", category: "mortgage", giver: "parents", ...over });
  it("parents deed her home to her: in-kind support at the presumed maximum value in June, none in July (SI 00835.400 F, Example 2)", () => {
    const plan = planMonths([home()], profile);
    expect(plan.months.map((m) => [m.month, m.ismValue])).toEqual([["2026-06", 351.33]]);
    expect(computeMonth("2026-07", [home()], profile).ismValue).toBe(0);
    const r = evaluateGift(home(), profile);
    expect(r.treatment.kind).toBe("ism_shelter");
    expect(r.ruleIds).toEqual(["R-SHEL-03", "R-GIE-01"]);
    expect(r.sourceKeys).toEqual(expect.arrayContaining(["poms-si-00835-400", "poms-si-00815-550"]));
    // 994 less the presumed maximum value after the $20 general exclusion, in the August check.
    expect(r.checkAfter).toBe(662.67);
    expect(r.paymentMonth).toBe("2026-08");
  });
  it("her son gives her the home she lives in: the gift's value is capped at the presumed maximum value (SI 00815.550 C.2)", () => {
    const [mar] = planMonths([home({ date: "2026-03-10", giver: "son" })], profile).months;
    expect(mar.month).toBe("2026-03");
    expect(mar.ismValue).toBe(351.33);
  });
  it("a home given as itself has no other route: it is not money to pay a shop or an ABLE account", () => {
    const r = evaluateGift(home(), profile);
    expect(r.alternatives.filter((a) => a.possible).map((a) => a.delivery)).toEqual(["item"]);
    expect(r.bestRoute).toBe("item");
    expect(r.explanation.plain).toMatch(/^A home given outright counts as housing support in the month it is given, valued at no more than \$351\.33/);
  });
  it("other housing given as itself counts too, and the item route stays closed for a housing bill paid by someone else", () => {
    expect(evaluateGift(g({ delivery: "item", category: "rent", amount: 300, recurring: true }), profile).checkAfter).toBe(714);
    expect(evaluateGift(g({ delivery: "item", category: "utility", amount: 90, recurring: true }), profile).ruleIds).toContain("R-SHEL-03");
    const bill = evaluateGift(g({ delivery: "vendor", category: "rent", amount: 300, recurring: true }), profile);
    expect(bill.alternatives.find((a) => a.delivery === "item")).toEqual({ delivery: "item", check: 0, possible: false, reason: "shelter_is_not_an_item" });
  });
});

describe("R-SHEL-04: housing bills paid by a co-owner (POMS SI 00835.360 D.3, SI 00835.310 B)", () => {
  const profile = { ...base, savings: 0 };
  // Warren's sibling co-owns the house and pays six months of arrears at $200 plus February and March, $1,600, on February 28.
  const arrears = (over: Partial<Gift> = {}) =>
    g({ date: "2026-02-28", amount: 1600, delivery: "vendor", category: "mortgage", giver: "sibling (co-owner)", covers: { from: "2025-08", to: "2026-03" }, payerCoOwns: true, ...over });
  it("each month from August through March counts $200, six past months, the current month and the next", () => {
    const plan = planMonths([arrears()], profile);
    expect(plan.months.map((m) => m.month)).toEqual(["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"]);
    expect(plan.months.every((m) => m.ismValue === 200)).toBe(true);
    // Received in eight months in a row, so none of it is one-off income.
    expect(plan.months.every((m) => m.infrequentExcluded === 0)).toBe(true);
    const r = evaluateGift(arrears(), profile);
    expect(r.ruleIds).toEqual(["R-SHEL-01", "R-GIE-01", "R-SHEL-04"]);
    expect(r.checkAfter).toBe(814);
  });
  it("the same payment as a gift from someone who does not own the home counts the past months when it is paid (SI 00835.360 B.1, D.2)", () => {
    const plan = planMonths([arrears({ payerCoOwns: undefined, giver: "sibling" })], profile);
    expect(plan.months.map((m) => [m.month, m.ismValue])).toEqual([["2026-02", 351.33], ["2026-03", 200]]);
    expect(evaluateGift(arrears({ payerCoOwns: undefined }), profile).ruleIds).toContain("R-SHEL-02");
  });
});

describe("R-SHEL-05: rent below market from a parent or child (POMS SI 00835.380 A.2, D; 89 FR 25507)", () => {
  const profile = { ...base, savings: 0 };
  // She pays $280 required rent; her child, the landlord, states a current market rental value of $410.
  const rent = (over: Partial<Gift> = {}) => g({ date: "2026-10-01", amount: 130, delivery: "vendor", category: "rent", giver: "child (landlord)", recurring: true, rentPaid: 280, ...over });
  it("SSA's own figures: the presumed maximum value ($334.33 in 2024) is below the market rent, so the subsidy is $334.33 less $280, $54.33", () => {
    expect(rentalSubsidy(410 - 280, 280, 334.33)).toBe(54.33);
  });
  it("at 2026 amounts the subsidy is $351.33 less $280, $71.33, counted in October", () => {
    const [oct] = planMonths([rent()], profile).months;
    expect(oct.ismValue).toBe(71.33);
    const r = evaluateGift(rent(), profile);
    expect(r.ruleIds).toEqual(["R-SHEL-05", "R-GIE-01"]);
    expect(r.checkAfter).toBe(942.67);
  });
  it("a market rent below the presumed maximum value counts the market rent less the rent paid", () => {
    expect(rentalSubsidy(100, 200, 351.33)).toBe(100);
  });
  it("rent at or above the presumed maximum value is a business arrangement: nothing is counted", () => {
    expect(rentalSubsidy(100, 360, 351.33)).toBe(0);
    expect(evaluateGift(rent({ amount: 100, rentPaid: 360 }), profile).checkAfter).toBe(994);
  });
  it("in another's household that provides all meals the one-third reduction applies instead (SI 00835.380 B)", () => {
    expect(evaluateGift(rent(), { ...profile, livesInAnothersHousehold: true }).ruleIds).toEqual(["R-SHEL-VTR"]);
  });
});

describe("rule table", () => {
  it("every rule has a plain explanation and at least one source", () => {
    for (const r of Object.values(RULES)) {
      expect(r.plain.length).toBeGreaterThan(10);
      expect(r.sourceKeys.length).toBeGreaterThan(0);
    }
  });
});

describe("the 2027 cost-of-living increase", () => {
  const profile = { ...DEFAULT_PROFILE };
  it("October income sets the December 2026 check at the 2026 rate", () => {
    expect(computeMonth("2026-10", [], profile).check).toBe(994);
  });
  it("November and December income set the January and February 2027 checks at the 2027 rate (POMS SI 02005.001 E.4.c)", () => {
    expect(computeMonth("2026-11", [], profile).check).toBe(1029);
    expect(computeMonth("2026-12", [], profile).check).toBe(1029);
  });
  it("housing help in November is valued with the 2027 presumed maximum value and one-third reduction", () => {
    const rent = (p: typeof profile) => computeMonth("2026-11", [{ id: "r", date: "2026-11-05", amount: 900, delivery: "vendor", category: "rent", recurring: true }], p);
    expect(rent(profile).ismValue).toBe(363);
    expect(rent(profile).check).toBe(round(1029 - (363 - 20)));
    expect(rent({ ...profile, livesInAnothersHousehold: true }).check).toBe(round(1029 - 343 - 0));
  });
});
const round = (n: number) => Math.round(n * 100) / 100;
