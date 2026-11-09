import { describe, expect, it } from "vitest";
import sources from "../content/sources.json";
import { DEFAULT_PROFILE, RULES, computeMonth, evaluateGift, markInfrequency, planMonths, rentalSubsidy, resourceTest, type Gift, type Profile } from "@/lib/rules";

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
  it("every source a rule cites is in content/sources.json, with its address", () => {
    const known = sources as Record<string, { url: string }>;
    for (const r of Object.values(RULES)) for (const k of r.sourceKeys) expect(known[k]?.url, `${r.id}: ${k}`).toMatch(/^https:\/\//);
  });
});

describe("R-SHEL-06: housing bills paid by the week (POMS SI 00835.474 B.3)", () => {
  const profile = { ...base, savings: 0 };
  // Bishop lives in a rooming house with a weekly rent of $25, and a sibling pays it: $25 times 13, divided by 3.
  const rent = (date: string, over: Partial<Gift> = {}) => g({ id: date, date, amount: 25, delivery: "vendor", category: "rent", giver: "sibling", recurring: true, every: "week", ...over });
  it("SSA's example: a $25 weekly rent is $108.33 a month, whether the month has four Mondays or five", () => {
    const april = planMonths(["2026-04-06", "2026-04-13", "2026-04-20", "2026-04-27"].map((d) => rent(d)), profile).months;
    expect(april.map((m) => [m.month, m.ismValue])).toEqual([["2026-04", 108.33]]);
    const june = planMonths(["2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22", "2026-06-29"].map((d) => rent(d)), profile).months;
    expect(june.map((m) => [m.month, m.ismValue])).toEqual([["2026-06", 108.33]]);
    // The same four payments with no frequency count as paid, $100.
    expect(planMonths(["2026-04-06", "2026-04-13", "2026-04-20", "2026-04-27"].map((d) => rent(d, { every: undefined })), profile).months[0].ismValue).toBe(100);
  });
  it("one weekly payment entered once counts the converted month, and is not one-off income", () => {
    const r = evaluateGift(rent("2026-04-06", { recurring: undefined }), profile);
    expect(r.trace.ismValue).toBe(108.33);
    expect(r.trace.infrequentExcluded).toBe(0);
    expect(r.ruleIds).toEqual(["R-SHEL-01", "R-GIE-01", "R-SHEL-06"]);
    // $994 less $108.33 after the $20 general exclusion.
    expect(r.checkAfter).toBe(905.67);
  });
  it("a two-week rent is halved, then converted as a weekly one: $50 every two weeks is $108.33", () => {
    expect(evaluateGift(rent("2026-04-06", { amount: 50, every: "two_weeks" }), profile).trace.ismValue).toBe(108.33);
  });
  it("the converted month is capped at the presumed maximum value, and cash given weekly counts as received", () => {
    expect(evaluateGift(rent("2026-04-06", { amount: 100 }), profile).trace.ismValue).toBe(351.33);
    expect(evaluateGift(rent("2026-04-06", { delivery: "cash", category: "other" }), profile).trace.cashIncome).toBe(25);
  });
});

describe("R-SHEL-07: housing help shared by the household (POMS SI 00835.350 B.4 and C, SI 00835.474 B.2, SI 00835.380 D.1.d)", () => {
  const profile = { ...base, savings: 0 };
  it("SSA's example: Jennifer and her roommate share a $1,200 property tax bill paid in March: March capped, then $50 a month", () => {
    const tax = g({ date: "2026-03-15", amount: 1200, delivery: "vendor", category: "property_tax", giver: "sibling", covers: { from: "2025-06", to: "2026-05" } });
    const plan = planMonths([tax], { ...profile, householdSize: 2 });
    // March: nine past months and March, $1,000, divided by two, $500, capped at the presumed maximum value.
    expect(plan.months.map((m) => [m.month, m.ismValue])).toEqual([["2026-03", 351.33], ["2026-04", 50], ["2026-05", 50]]);
    expect(plan.gifts[0].ruleIds).toEqual(["R-SHEL-01", "R-GIE-01", "R-SHEL-02", "R-SHEL-07"]);
    // Alone, the same bill counts $100 a month after March.
    expect(planMonths([tax], profile).months.map((m) => m.ismValue)).toEqual([351.33, 100, 100]);
  });
  it("SSA's couple example: a son pays $1,300 of property tax for the next 12 months; three in the household, $72.22 to the couple", () => {
    const tax = g({ date: "2026-03-20", amount: 1300, delivery: "vendor", category: "property_tax", giver: "son", covers: { from: "2026-04", to: "2027-03" } });
    const april = planMonths([tax], { ...profile, couple: true, householdSize: 3 }).months.find((m) => m.month === "2026-04")!;
    // $108.33 a month, divided by three, $36.11 each, times two for the couple.
    expect(april.ismValue).toBe(72.22);
  });
  it("SSA's cousins example: a sibling pays $400 of a $1,300 tax bill for two household members, $16.66 each a month", () => {
    const tax = g({ date: "2026-06-05", amount: 400, delivery: "vendor", category: "property_tax", giver: "sibling", covers: { from: "2026-06", to: "2027-05" } });
    const july = planMonths([tax], { ...profile, householdSize: 2 }).months.find((m) => m.month === "2026-07")!;
    // $400 divided by 12, then by two; SSA rounds the cent down.
    expect(july.ismValue).toBeCloseTo(16.66, 1);
  });
  it("a rental subsidy is divided among the household, and neither a home given as itself nor the one-third reduction is", () => {
    const subsidy = g({ date: "2026-10-01", amount: 130, delivery: "vendor", category: "rent", giver: "child (landlord)", recurring: true, rentPaid: 280 });
    expect(computeMonth("2026-10", [subsidy], { ...profile, householdSize: 2 }).ismValue).toBe(35.67);
    const home = g({ date: "2026-06-15", amount: 40000, delivery: "item", category: "mortgage", giver: "parents" });
    expect(computeMonth("2026-06", [home], { ...profile, householdSize: 3 }).ismValue).toBe(351.33);
    expect(evaluateGift(home, { ...profile, householdSize: 3 }).ruleIds).not.toContain("R-SHEL-07");
    const vtr = evaluateGift(g({ delivery: "vendor", category: "rent", amount: 500, recurring: true }), { ...profile, livesInAnothersHousehold: true, householdSize: 4 });
    expect(vtr.ruleIds).toEqual(["R-SHEL-VTR"]);
    expect(vtr.checkAfter).toBe(662.67);
  });
  it("a household size of one, or two for a couple, changes nothing", () => {
    const rent = g({ delivery: "vendor", category: "rent", amount: 300, recurring: true });
    expect(evaluateGift(rent, { ...profile, householdSize: 1 }).trace).toEqual(evaluateGift(rent, profile).trace);
    expect(evaluateGift(rent, { ...profile, couple: true, householdSize: 2 }).trace).toEqual(evaluateGift(rent, { ...profile, couple: true }).trace);
  });
});

describe("R-RES-01 and R-ABLE-03: the resource test, with an ABLE balance over $100,000 (POMS SI 01110.003, SI 01130.740 D.1)", () => {
  const june = (p: Partial<Profile>) => computeMonth("2026-06", [], { ...DEFAULT_PROFILE, ableEligible: true, ...p });
  it("SSA's example: Paul's ABLE account holds $101,000 and his checking $1,500; $2,500 counts, his SSI is suspended and Medicaid continues", () => {
    const m = june({ ableBalance: 101_000, savings: 1_500 });
    expect(m.resources).toMatchObject({ ableExcess: 1_000, other: 1_500, countable: 2_500, limit: 2_000, over: true, status: "able_suspension" });
    expect(m.check).toBe(0);
    expect(m.incomeCheck).toBe(994);
  });
  it("SSA's example: Christine's ABLE account holds $101,000 and her checking $3,000; her checking alone is over, so she is not eligible", () => {
    const m = june({ ableBalance: 101_000, savings: 3_000 });
    expect(m.resources).toMatchObject({ countable: 4_000, over: true, status: "excess" });
    expect(m.check).toBe(0);
  });
  it("$100,000 in the account and $2,000 in savings is within the limit; a couple's limit is $3,000", () => {
    expect(june({ ableBalance: 100_000, savings: 2_000 }).check).toBe(994);
    expect(june({ ableBalance: 100_500, savings: 1_500 }).resources).toMatchObject({ countable: 2_000, over: false, status: "under" });
    expect(june({ couple: true, savings: 2_500 }).check).toBe(1491);
    expect(june({ couple: true, savings: 3_000.01 }).check).toBe(0);
  });
  it("an ABLE gift that takes the account past $100,000 counts the part over toward savings, and says so", () => {
    const profile = { ...base, ableBalance: 99_950 };
    const bill = evaluateGift(g({ date: "2026-11-10", amount: 138, delivery: "able", category: "utility", recurring: true }), profile);
    expect(bill.resourcesAfter).toMatchObject({ ableBalance: 100_088, ableExcess: 88, countable: 1_328, over: false });
    expect(bill.checkAfter).toBe(bill.checkBaseline);
    expect(bill.ruleIds).toContain("R-ABLE-03");
    expect(bill.explanation.plain).toContain("This gift takes it to $100,088, so $88 counts toward her savings, $1,328 in all on December 1, 2026. That is within the $2,000 limit");
    const large = evaluateGift(g({ date: "2026-11-10", amount: 1_500, delivery: "able", category: "other" }), profile);
    expect(large.resourcesAfter).toMatchObject({ ableExcess: 1_450, countable: 2_690, over: true, status: "able_suspension" });
    expect(large.checkAfter).toBe(0);
    expect(large.ruleIds).toEqual(expect.arrayContaining(["R-ABLE-01", "R-ABLE-03", "R-RES-01"]));
    expect(large.alternatives.find((a) => a.delivery === "able")).toEqual({ delivery: "able", check: 0, possible: true, reason: "able_over_resource_limit" });
    // Routed elsewhere: the item itself keeps the check.
    expect([large.bestRoute, large.checkWithBestRoute]).toEqual(["item", 1029]);
    expect(large.explanation.plain).toMatch(/over the \$2,000 limit because of the ABLE account, so SSI cash stops while it stays over, and Medicaid continues: her January 2027 check would be \$0\. Giving the item itself keeps her January 2027 check at \$1,029\./);
  });
  it("savings already over the limit: no SSI whatever the gift, and every answer says why", () => {
    const r = evaluateGift(g({ delivery: "vendor", category: "equipment", amount: 420 }), { ...base, savings: 2_400 });
    expect([r.checkBaseline, r.checkAfter]).toEqual([0, 0]);
    expect(r.ruleIds).toContain("R-RES-01");
    expect(r.explanation.plain).toMatch(/Her countable resources on May 1, 2026 are \$2,400\. That is over the \$2,000 limit, so no SSI is paid while it stays over\.$/);
  });
  it("cash she may keep is a warning on the 1st, as before: the check follows her income", () => {
    const r = evaluateGift(g({}), base);
    expect(r.checkAfter).toBe(74);
    expect(r.trace.resources.over).toBe(false);
    expect(resourceTest(base, "2026-05", 0, 1000)).toMatchObject({ countable: 2_240, over: true });
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
