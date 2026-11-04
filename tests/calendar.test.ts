import { describe, expect, it } from "vitest";
import { calendarModel, checkChanges, type CalGift } from "../src/lib/calendar/model";
import { DEFAULT_PROFILE } from "../src/lib/rules";

const base = { ...DEFAULT_PROFILE, ableEligible: true, savings: 0 };
const gift = (id: string, date: string, amount: number, delivery: CalGift["delivery"] = "cash"): CalGift => ({ id, date, amount, delivery, category: "other", giver: id, paidTo: "Shop", need: "Birthday" });

describe("the benefit calendar", () => {
  it("puts each check on the 1st, set by income two months earlier, and each report due on the 10th", () => {
    const { events, checks } = calendarModel([gift("a", "2026-09-30", 200)], base, "cash");
    expect(checks.map((c) => c.paidOn)).toEqual(["2026-09-01", "2026-10-01", "2026-11-01"]);
    expect(checks.find((c) => c.paidOn === "2026-11-01")?.amount).toBe(874); // $200 less $60 and $20 leaves $120 counted, from September
    expect(events.find((e) => e.id === "due-2026-09")?.startDate).toBe("2026-10-10");
    expect(events.find((e) => e.id === "a")?.resourceId).toBe("counts");
  });

  it("moving a cash gift one day, from September 30 to October 1, moves it to the next check", () => {
    const before = [gift("a", "2026-09-30", 200)];
    const after = [gift("a", "2026-10-01", 200)];
    const span = { first: "2026-09", last: "2026-10" };
    const changes = checkChanges(calendarModel(before, base, "cash", span).checks, calendarModel(after, base, "cash", span).checks);
    expect(changes).toEqual([
      { paidOn: "2026-11-01", before: 874, after: 994 },
      { paidOn: "2026-12-01", before: 994, after: 874 },
    ]);
  });

  it("the same quarter shares one $60: a second cash gift in October gets none, one in January gets its own", () => {
    const oct = calendarModel([gift("a", "2026-10-02", 100), gift("b", "2026-10-20", 100)], base, "cash").checks;
    expect(oct.find((c) => c.paidOn === "2026-12-01")?.amount).toBe(994 - (200 - 60 - 20));
    const split = calendarModel([gift("a", "2026-12-30", 100), gift("b", "2027-01-02", 100)], base, "cash").checks;
    expect(split.find((c) => c.paidOn === "2027-02-01")?.amount).toBe(1029 - 20);
    expect(split.find((c) => c.paidOn === "2027-03-01")?.amount).toBe(1029 - 20);
  });

  it("gifts paid to the shop stay green on any day", () => {
    const { events } = calendarModel([gift("a", "2026-09-30", 200, "vendor")], { ...base }, "given");
    expect(events.find((e) => e.id === "a")?.resourceId).toBe("kept");
  });
});
