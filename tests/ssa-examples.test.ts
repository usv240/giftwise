import { describe, expect, it } from "vitest";
import data from "../content/eval/ssa-examples.json";
import sources from "../content/sources.json";
import { DEFAULT_PROFILE, evaluateGift, planMonths, type Gift, type Profile } from "../src/lib/rules";

const SRC = sources as Record<string, unknown>;
type Value = { month: string; measure: "after_infrequent" | "ism_value" | "ssi_amount"; value: number };

/** The rules engine's figure for one of SSA's stated answers. */
function figure(gifts: Gift[], profile: Profile, v: Value) {
  const t = planMonths(gifts, profile).months.find((m) => m.month === v.month);
  if (!t) return v.measure === "ssi_amount" ? null : 0;
  if (v.measure === "ism_value") return t.ismValue;
  if (v.measure === "ssi_amount") return t.check;
  return Math.round((t.cashIncome + t.inKindIncome + t.ismValue - t.infrequentExcluded) * 100) / 100;
}

describe("Social Security's own worked examples", () => {
  const profile = (c: (typeof data.cases)[number]): Profile => ({ ...DEFAULT_PROFILE, ableEligible: true, savings: 0, ...("profile" in c ? c.profile : {}) });
  const agrees = (c: (typeof data.cases)[number]) =>
    (c.expected.values as Value[]).every((v) => {
      const got = figure(c.gifts as Gift[], profile(c), v);
      return got !== null && Math.abs(got - v.value) <= 1;
    });

  it("the engine matches every example except the one prepaid bill it does not spread over the months it covers", () => {
    const misses = data.cases.filter((c) => !agrees(c)).map((c) => c.id);
    expect(misses).toEqual(["property-tax-prepaid"]);
  });

  it("every example cites a known source and quotes SSA's text", () => {
    for (const c of data.cases) {
      expect(SRC[c.source], c.id).toBeDefined();
      expect(c.passage.length, c.id).toBeGreaterThan(80);
    }
  });

  it("R-ITEM-02: football tickets count at their value, given or bought from the box office", () => {
    for (const delivery of ["item", "vendor"] as const) {
      const r = evaluateGift({ id: "t", date: "2026-08-12", amount: 100, delivery, category: "event" }, { ...DEFAULT_PROFILE, ableEligible: true });
      expect(r.treatment.kind).toBe("unearned_in_kind");
      expect(r.ruleIds).toContain("R-ITEM-02");
      expect(r.countedAmount).toBe(20); // $100 less the $60 infrequent and $20 general exclusions
    }
  });
});
