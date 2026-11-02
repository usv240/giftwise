import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE, RULES, computeMonth, evaluateGift, markInfrequency, planMonths, type Gift, type Profile } from "@/lib/rules";

const base: Profile = { ...DEFAULT_PROFILE, savings: 1240 };
const g = (over: Partial<Gift>): Gift => ({ id: "t", date: "2026-04-10", amount: 1000, delivery: "cash", category: "other", ...over });

describe("pronouns in explanations", () => {
  it("uses their for they/them, and never changes the math", () => {
    const g = { id: "p", date: "2026-11-10", amount: 420, delivery: "vendor" as const, category: "equipment" as const };
    const they = evaluateGift(g, { ...DEFAULT_PROFILE, pronoun: "they" });
    const she = evaluateGift(g, DEFAULT_PROFILE);
    expect(they.explanation.plain).toMatch(/Their \w+ check stays/);
    expect(they.explanation.plain).not.toMatch(/\bher\b/i);
    expect(she.explanation.plain).toMatch(/Her \w+ check stays/);
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

  it("R-SHEL-01 with R-INFREQ-01: a one-off rent payment also gets the $60 exclusion", () => {
    const r = evaluateGift(g({ delivery: "vendor", category: "rent", amount: 800 }), base);
    expect(r.checkAfter).toBe(722.67);
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

describe("rule table", () => {
  it("every rule has a plain explanation and at least one source", () => {
    for (const r of Object.values(RULES)) {
      expect(r.plain.length).toBeGreaterThan(10);
      expect(r.sourceKeys.length).toBeGreaterThan(0);
    }
  });
});
