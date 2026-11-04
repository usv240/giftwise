import { describe, expect, it } from "vitest";
import sample from "../content/sample-year.json";
import { buildReport, type ReportGift } from "@/lib/report/ssa";
import { reportCode, verifyPath } from "@/lib/report/verify";
import { DEFAULT_PROFILE, type Category, type Delivery } from "@/lib/rules";

type S = { date: string; giver: string; need: string; paidTo: string; delivery: Delivery; category: Category; amount: number; recurring: boolean };
const gifts: ReportGift[] = (sample.gifts as S[]).map((g, i) => ({ id: `s${i}`, ...g, evidence: { kind: "sample" } }));
const maya = { name: "Maya", profile: { ...DEFAULT_PROFILE, pronoun: "she" as const }, gifts, today: "2026-11-03" };
const october = (g: ReportGift[] = gifts, today = "2026-11-03") => buildReport({ ...maya, gifts: g, today, month: "2026-10" });

describe("a report that proves itself: the report code", () => {
  it("is ten characters in Crockford base 32, shown as XXXXX-XXXXX, and its link names the page and month", () => {
    const code = reportCode("maya", october());
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
    expect(verifyPath("maya", "2026-10", code)).toBe(`/v/maya/2026-10/${code}`);
  });

  it("is the same for the same facts, on any day the report is opened", () => {
    expect(reportCode("maya", october(gifts, "2026-11-03"))).toBe(reportCode("maya", october(gifts, "2026-11-09")));
  });

  it("changes when any gift's amount, recipient or PayPal record changes, or a gift is added", () => {
    const base = reportCode("maya", october());
    const first = gifts.findIndex((g) => g.date.startsWith("2026-10"));
    const edit = (over: Partial<ReportGift>) => gifts.map((g, i) => (i === first ? { ...g, ...over } : g));
    expect(reportCode("maya", october(edit({ amount: gifts[first].amount + 1 })))).not.toBe(base);
    expect(reportCode("maya", october(edit({ paidTo: "Someone else" })))).not.toBe(base);
    expect(reportCode("maya", october(edit({ evidence: { kind: "paypal_capture", orderId: "5O190127TN364715T", captureId: "3C679366HH908993F" } })))).not.toBe(base);
    expect(reportCode("maya", october([...gifts, { ...gifts[first], id: "extra", date: "2026-10-30" }]))).not.toBe(base);
  });

  it("belongs to one page: the same gifts on another page get another code", () => {
    expect(reportCode("maya", october())).not.toBe(reportCode("lena", october()));
  });
});
