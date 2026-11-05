import { describe, expect, it } from "vitest";
import { diffPlans, needsForMonth, planFor, type NeedRow } from "@/lib/monthly";
import { DEFAULT_PROFILE } from "@/lib/rules";

const at = (iso: string) => new Date(`${iso}T15:00:00Z`);
const need = (o: Partial<NeedRow> & Pick<NeedRow, "id" | "title" | "category" | "route" | "amount">): NeedRow => ({
  householdId: 1,
  detail: "",
  payeeName: o.route === "able" ? "Maya's ABLE account" : `${o.title} shop`,
  payeeAccount: o.route === "able" ? "able" : "vendor:riverside",
  recurring: false,
  link: null,
  status: "open",
  funded: "0",
  sortOrder: o.id,
  createdAt: at("2026-10-01"),
  ...o,
});
const NEEDS: NeedRow[] = [
  need({ id: 1, title: "Electric bill", category: "utility", route: "able", amount: "138.00", recurring: true }),
  need({ id: 2, title: "Wheelchair repair", category: "equipment", route: "vendor", amount: "420.00", funded: "300.00", status: "partial" }),
  need({ id: 3, title: "Laptop for college", category: "education", route: "vendor", amount: "649.00" }),
];
const ABLE = "Maya's ABLE account";
const profile = { ...DEFAULT_PROFILE, pronoun: "she" as const };

describe("monthly gifts", () => {
  it("a recurring need opens again each month with only what it received that month", () => {
    const pays = [{ needId: 1, amount: "138.00", status: "captured", capturedAt: at("2026-11-04"), orderId: "A" }];
    expect(needsForMonth(NEEDS, pays, "2026-11").find((n) => n.id === 1)?.funded).toBe(138);
    expect(needsForMonth(NEEDS, pays, "2026-12").find((n) => n.id === 1)?.funded).toBe(0);
  });

  it("a payment made early for December's gift counts toward December, not the month it was paid", () => {
    const pays = [{ needId: 1, amount: "138.00", status: "captured", capturedAt: at("2026-11-04"), orderId: "DEC" }];
    const paidFor = new Map([["DEC", "2026-12"]]);
    expect(needsForMonth(NEEDS, pays, "2026-11", paidFor).find((n) => n.id === 1)?.funded).toBe(0);
    expect(needsForMonth(NEEDS, pays, "2026-12", paidFor).find((n) => n.id === 1)?.funded).toBe(138);
  });

  it("$300 a month: November pays the electric bill and finishes the wheelchair repair; December moves on to the laptop", () => {
    const nov = planFor(300, needsForMonth(NEEDS, [], "2026-11"), "2026-11", profile, ABLE);
    expect(nov.lines.map((l) => [l.title, l.amount])).toEqual([
      ["Electric bill", 138],
      ["Wheelchair repair", 120],
      ["Laptop for college", 42],
    ]);
    expect(nov.checkWithRouting).toBe(1029);

    // After November is paid: the repair is paid in full, the laptop has $42.
    const after = NEEDS.map((n) => (n.id === 2 ? { ...n, funded: "420.00", status: "paid" } : n.id === 3 ? { ...n, funded: "42.00", status: "partial" } : n));
    const decNeeds = needsForMonth(after, [], "2026-12");
    const dec = planFor(300, decNeeds, "2026-12", profile, ABLE);
    expect(dec.lines.map((l) => [l.title, l.amount])).toEqual([
      ["Electric bill", 138],
      ["Laptop for college", 162],
    ]);
    const changes = diffPlans(nov, dec, decNeeds, ABLE);
    expect(changes).toEqual([
      { kind: "removed", title: "Wheelchair repair", payee: "Wheelchair repair shop", from: 120, to: 0, why: "Wheelchair repair is paid in full, so nothing goes there now." },
      { kind: "changed", title: "Laptop for college", payee: "Laptop for college shop", from: 42, to: 162, why: "Needs before it take less this month, so more is left for this one." },
    ]);
    expect(dec.checkWithRouting).toBe(1029);
  });

  it("the first month has nothing to compare with", () => {
    const nov = planFor(300, needsForMonth(NEEDS, [], "2026-11"), "2026-11", profile, ABLE);
    expect(diffPlans(null, nov, [], ABLE)).toEqual([]);
  });
});
