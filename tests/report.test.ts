import { describe, expect, it } from "vitest";
import sample from "../content/sample-year.json";
import { buildReport, currentReportMonth, dueFor, reportCsv, type ReportGift } from "@/lib/report/ssa";
import { DEFAULT_PROFILE, type Category, type Delivery } from "@/lib/rules";

type S = { date: string; giver: string; need: string; paidTo: string; delivery: Delivery; category: Category; amount: number; recurring: boolean };
const gifts: ReportGift[] = (sample.gifts as S[]).map((g, i) => ({ id: `s${i}`, ...g, evidence: { kind: "sample" } }));
const maya = { name: "Maya", profile: { ...DEFAULT_PROFILE, pronoun: "she" as const }, gifts, today: "2026-11-03" };

describe("monthly report to Social Security", () => {
  it("October as given: five gifts, nothing counts, her January check stays $994, due November 10", () => {
    const r = buildReport({ ...maya, month: "2026-10" });
    expect(r.status).toBe("nothing_counts");
    expect(r.totals.gifts).toBe(5);
    expect(r.totals.given).toBe(618);
    expect(r.totals.counted).toBe(0);
    expect(r.totals.check).toBe(994);
    expect(r.totals.checkMonthLabel).toBe("December 2026");
    expect(r.lines.every((l) => l.section === "records")).toBe(true);
    expect(r.due).toMatchObject({ date: "2026-11-10", daysLeft: 7, state: "open" });
    expect(r.script).toEqual([]);
  });

  it("the electric bill sent to her ABLE account comes with a reminder to pay it from there this month", () => {
    const r = buildReport({ ...maya, month: "2026-10" });
    const todo = r.todo.find((t) => t.id === "able-housing");
    expect(todo?.ruleId).toBe("R-ABLE-02");
    expect(todo?.text).toMatch(/^Pay the electric bill from the ABLE account before October ends/);
  });

  it("the same October as cash: every gift is one to tell SSA, and the check drops by what counts", () => {
    const r = buildReport({ ...maya, month: "2026-10", view: "cash" });
    expect(r.status).toBe("report");
    expect(r.totals.tell).toBe(5);
    expect(r.totals.counted).toBeGreaterThan(400);
    expect(r.totals.check).toBe(Math.round((994 - r.totals.counted) * 100) / 100);
    expect(r.script[0]).toBe("Hello. My name is Maya, and I am calling to report changes to my SSI for October 2026.");
    expect(r.script).toHaveLength(7);
    // The script never asks for, or prints, anything like a Social Security number.
    expect(r.script.join(" ")).not.toMatch(/\d{3}-?\d{2}-?\d{4}/);
  });

  it("rent paid straight to the landlord is housing help SSA must hear about", () => {
    const rent: ReportGift = { id: "r1", date: "2026-10-02", amount: 800, delivery: "vendor", category: "rent", giver: "Dan", need: "Rent, October", paidTo: "Oak Street Apartments", evidence: { kind: "sample" } };
    const r = buildReport({ ...maya, gifts: [rent], month: "2026-10" });
    expect(r.lines[0]).toMatchObject({ section: "tell", kind: "ism_shelter" });
    expect(r.lines[0].say).toBe("On October 2, Dan paid $800 toward my rent, straight to Oak Street Apartments.");
    expect(r.totals.counted).toBeGreaterThan(0);
    expect(r.totals.check).toBeLessThan(994);
  });

  it("every records line names a rule and a source with a link", () => {
    const r = buildReport({ ...maya, month: "2026-08" });
    for (const l of r.lines) {
      expect(l.ruleIds.length).toBeGreaterThan(0);
      expect(l.sources.every((s) => s.url.startsWith("https://"))).toBe(true);
    }
    expect(r.passages.map((p) => p.cite)).toContain("20 CFR 416.714(a)");
  });

  it("deadlines follow 20 CFR 416.714: in progress, open, due soon, past", () => {
    expect(dueFor("2026-11", "2026-11-03").state).toBe("in_progress");
    expect(dueFor("2026-10", "2026-11-03").state).toBe("open");
    expect(dueFor("2026-10", "2026-11-08")).toMatchObject({ state: "due_soon", daysLeft: 2 });
    expect(dueFor("2026-01", "2026-11-03").state).toBe("past");
  });

  it("the report that matters now is last month until its deadline passes", () => {
    expect(currentReportMonth("2026-11-03", ["2026-10", "2026-11"])).toBe("2026-10");
    expect(currentReportMonth("2026-11-15", ["2026-10", "2026-11"])).toBe("2026-11");
    expect(currentReportMonth("2026-11-15", ["2026-09", "2026-10"])).toBe("2026-10");
  });

  it("a month with no gifts says so plainly", () => {
    const r = buildReport({ ...maya, month: "2025-12" });
    expect(r.status).toBe("no_gifts");
    expect(r.headline).toBe("No gifts through Giftwise in December.");
  });

  it("CSV has a header and one row per gift", () => {
    const csv = reportCsv(buildReport({ ...maya, month: "2026-10" })).trim().split("\n");
    expect(csv[0]).toBe("date,from,for,paid_to,amount,tell_ssa,how_it_counts,rule_ids,evidence");
    expect(csv).toHaveLength(6);
  });
});
