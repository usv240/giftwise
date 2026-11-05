import { describe, expect, it } from "vitest";
import { MAX_GIFT, asTyped, readAmount, suggestedAmounts } from "@/components/gift/amount";
import { DEFAULT_PROFILE } from "@/lib/rules";
import type { OpenNeed } from "@/lib/routing";

const needs: OpenNeed[] = [
  { id: 1, title: "Wheelchair repair", category: "equipment", route: "vendor", payeeName: "Riverside", payeeAccount: "vendor", amount: 420, funded: 0, recurring: false },
  { id: 2, title: "Laptop", category: "education", route: "vendor", payeeName: "Bookstore", payeeAccount: "vendor", amount: 649, funded: 0, recurring: false },
  { id: 3, title: "Electric bill", category: "utility", route: "able", payeeName: "ABLE", payeeAccount: "able", amount: 138, funded: 0, recurring: true },
];
const all = (n: number) => `All ${n} needs`;

describe("readAmount (Give any amount)", () => {
  it("reads the ways people type dollars", () => {
    for (const [typed, value] of [["50", 50], ["$50", 50], ["$ 50", 50], ["50.00", 50], ["1,000", 1000], ["$1,000.50", 1000.5], [" 75 ", 75], [".5", 0.5]] as const) {
      expect(readAmount(typed)).toEqual({ kind: "ok", value });
    }
  });

  it("does not clamp or drop signs: too much stays too much, and a minus sign or letters are not an amount", () => {
    expect(readAmount("50000")).toEqual({ kind: "ok", value: 50000 });
    expect(readAmount("50000").kind === "ok" && 50000 > MAX_GIFT).toBe(true);
    for (const typed of ["-50", "abc", "50,5", "50.005", "1,00", ".", "5 0 0x"]) expect(readAmount(typed).kind).toBe("invalid");
    expect(readAmount("  ").kind).toBe("empty");
  });

  it("a chip fills the field the way a person would type it", () => {
    expect(asTyped(1207)).toBe("1207");
    expect(asTyped(95.5)).toBe("95.50");
  });
});

describe("suggestedAmounts", () => {
  it("offers two small amounts, the first need, and all the needs, each routed exactly as labeled", () => {
    const chips = suggestedAmounts(needs, "2026-11-10", DEFAULT_PROFILE, "Maya's ABLE account", all);
    expect(chips).toEqual([{ amount: 50 }, { amount: 100 }, { amount: 420, label: "Wheelchair repair" }, { amount: 1207, label: "All 3 needs" }]);
  });

  it("a need already partly given suggests what is left of it", () => {
    const chips = suggestedAmounts(needs.map((n) => (n.id === 1 ? { ...n, funded: 400 } : n)), "2026-11-10", DEFAULT_PROFILE, "Maya's ABLE account", all);
    expect(chips.find((c) => c.label === "Wheelchair repair")?.amount).toBe(20);
  });

  it("with one open need there is no separate all-needs chip", () => {
    const chips = suggestedAmounts([needs[0]], "2026-11-10", DEFAULT_PROFILE, "Maya's ABLE account", all);
    expect(chips.map((c) => c.label ?? c.amount)).toEqual([50, 100, "Wheelchair repair"]);
  });
});
