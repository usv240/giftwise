import { describe, expect, it } from "vitest";
import { INVARIANTS, runInvariants } from "@/lib/invariants";
import { routeGift } from "@/lib/routing";

describe("invariants: random gifts, needs and people through the router", () => {
  it("1,000 random gifts keep every promise", () => {
    const run = runInvariants(1_000, 7);
    for (const r of run.results) expect({ id: r.id, broken: r.broken, case: r.firstBroken }).toEqual({ id: r.id, broken: 0, case: undefined });
    expect(run.results).toHaveLength(INVARIANTS.length);
  }, 60_000);

  it("small housing payments that each fit the exclusions are not combined past them", () => {
    const needs = [1, 2, 3].map((id) => ({ id, title: `Utility ${id}`, category: "utility", route: "vendor", payeeName: "Utility", payeeAccount: "u", amount: 50, funded: 0, recurring: false }));
    const r = routeGift(150, needs, "2026-11-10");
    expect(r.checkWithRouting).toBe(r.baseline);
    expect(r.lines.reduce((a, l) => a + l.amount, 0) + r.unplaced).toBe(150);
  });

  it("ABLE deposits from one gift share the year's $20,000 limit, and the rest is handed back", () => {
    const profile = { couple: false, livesInAnothersHousehold: false, otherUnearnedMonthly: 0, earnedMonthly: 0, ableEligible: true, ableBalance: 0, ableContributedThisYear: 19_500, savings: 500 };
    const needs = [{ id: 1, title: "Electric bill", category: "utility", route: "able", payeeName: "ABLE", payeeAccount: "able", amount: 400, funded: 0, recurring: false }];
    const r = routeGift(1_000, needs, "2026-11-10", profile);
    expect(r.lines.filter((l) => l.route === "able").reduce((a, l) => a + l.amount, 0)).toBe(500);
    expect(r.unplaced).toBe(500);
    expect(r.checkWithRouting).toBe(r.baseline);
  });

  it("a need marked for ABLE is skipped for someone who cannot have an ABLE account", () => {
    const profile = { couple: false, livesInAnothersHousehold: false, otherUnearnedMonthly: 0, earnedMonthly: 0, ableEligible: false, ableBalance: 0, ableContributedThisYear: 0, savings: 500 };
    const needs = [{ id: 1, title: "Electric bill", category: "utility", route: "able", payeeName: "ABLE", payeeAccount: "able", amount: 138, funded: 0, recurring: true }];
    const r = routeGift(138, needs, "2026-11-10", profile);
    expect(r.lines).toHaveLength(0);
    expect(r.unplaced).toBe(138);
  });
});
