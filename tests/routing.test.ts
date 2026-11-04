import { describe, expect, it } from "vitest";
import { routeGift, type OpenNeed } from "@/lib/routing";

const needs: OpenNeed[] = [
  { id: 1, title: "Wheelchair repair", category: "equipment", route: "vendor", payeeName: "Riverside", payeeAccount: "vendor", amount: 420, funded: 0, recurring: false },
  { id: 2, title: "Laptop", category: "education", route: "vendor", payeeName: "Bookstore", payeeAccount: "vendor", amount: 649, funded: 0, recurring: false },
  { id: 3, title: "Electric bill", category: "utility", route: "able", payeeName: "ABLE", payeeAccount: "able", amount: 138, funded: 0, recurring: true },
];

describe("routeGift", () => {
  it("$500 fills the first need and part of the next, and her January check stays $1,029 at the 2027 rate (cash would leave $609)", () => {
    const r = routeGift(500, needs, "2026-11-10");
    expect(r.lines.map((l) => [l.needId, l.amount])).toEqual([
      [1, 420],
      [2, 80],
    ]);
    expect(r.checkWithRouting).toBe(1029);
    expect(r.checkIfCash).toBe(1029 - (500 - 60 - 20));
    expect(r.unplaced).toBe(0);
  });

  it("skips needs that are already funded and sends the rest to ABLE", () => {
    const r = routeGift(1500, needs.map((n) => (n.id === 1 ? { ...n, funded: 420 } : n)), "2026-11-10");
    expect(r.lines.map((l) => l.referenceId)).toEqual(["need-2", "need-3", "able-savings"]);
    expect(r.lines.at(-1)!.amount).toBe(1500 - 649 - 138);
    expect(r.checkWithRouting).toBe(1029);
  });

  it("never routes in a way that lowers the check", () => {
    const risky: OpenNeed[] = [{ id: 9, title: "Rent", category: "rent", route: "vendor", payeeName: "Landlord", payeeAccount: "vendor", amount: 800, funded: 0, recurring: true }];
    const r = routeGift(800, risky, "2026-11-10");
    expect(r.lines.every((l) => l.route === "able")).toBe(true);
    expect(r.checkWithRouting).toBe(1029);
  });

  it("leaves money unplaced when ABLE is not possible and no safe need is open", () => {
    const r = routeGift(300, [], "2026-11-10", { couple: false, livesInAnothersHousehold: false, otherUnearnedMonthly: 0, earnedMonthly: 0, ableEligible: false, ableBalance: 0, ableContributedThisYear: 0, savings: 1240 });
    expect(r.lines).toHaveLength(0);
    expect(r.unplaced).toBe(300);
  });
});
