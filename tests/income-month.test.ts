import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { paymentGift, type GiftSubject } from "@/lib/report/data";
import { buildReport, reportCsv } from "@/lib/report/ssa";
import { easyRead } from "@/lib/report/easy";
import { reportCode } from "@/lib/report/verify";
import { receiptMoment } from "@/lib/receipt";
import { today as envelopeToday } from "@/lib/api/envelope";
import { incomeDay, incomeMonth, paymentDay, shownAt, shownDay, shownTime, today, ZONE, ZONE_SHORT } from "@/lib/time";
import { DEFAULT_PROFILE, monthOf } from "@/lib/rules";
import { routeGift } from "@/lib/routing";

/**
 * One income date for a gift, in one zone, everywhere: SSI counts income in the month it is received (20 CFR
 * 416.1123(a); POMS SI 00810.030), and src/lib/time.ts dates a payment by the day PayPal captured it in Pacific time.
 * Two gifts on the last evening of October, as UTC would put them in November, stay in October on the routing, the
 * receipt, the report, the check page's code, the CSV, Easy Read and the MCP report.
 */

// 11:30 PM Pacific on October 31, 2026 (daylight time, UTC-7), which is 06:30 on November 1 in UTC.
const LATE_PACIFIC = new Date("2026-11-01T06:30:00Z");
// 12:30 AM UTC on November 1, 2026, which is 5:30 PM Pacific on October 31.
const EARLY_UTC = new Date("2026-11-01T00:30:00Z");

const row = (id: number, at: Date) => ({ id, capturedAt: at, createdAt: new Date(at.getTime() - 60_000), amount: "120.00", route: "vendor", payerName: "Dan Lee", payeeName: "Riverside Mobility", orderId: `ORDER${id}AAAAAAAA`, captureId: `CAP${id}` });
const NEED = { title: "Wheelchair repair", category: "equipment" };

const subject = (): GiftSubject => ({ slug: "lee", name: "Lee", isSample: false, profile: DEFAULT_PROFILE, gifts: [paymentGift(row(1, LATE_PACIFIC), NEED), paymentGift(row(2, EARLY_UTC), NEED)] });

vi.mock("@/lib/report/data", async (orig) => ({ ...(await orig<typeof import("@/lib/report/data")>()), giftSubject: async (slug: string) => (slug === "lee" ? subject() : null) }));

describe("the income date is one day in one zone", () => {
  it("dates both instants on October 31 in Pacific time, where UTC would say November 1", () => {
    for (const at of [LATE_PACIFIC, EARLY_UTC]) {
      expect(at.toISOString().slice(0, 10)).toBe("2026-11-01");
      expect(incomeDay(at)).toBe("2026-10-31");
      expect(incomeMonth(at)).toBe("2026-10");
    }
    expect(ZONE).toBe("America/Los_Angeles");
  });

  it("dates a payment by its capture, or by its order before a capture", () => {
    expect(paymentDay({ capturedAt: LATE_PACIFIC, createdAt: new Date("2026-10-30T12:00:00Z") })).toBe("2026-10-31");
    expect(paymentDay({ capturedAt: null, createdAt: LATE_PACIFIC })).toBe("2026-10-31");
  });

  it("keeps standard time too: 11:30 PM Pacific on November 30 is still November", () => {
    expect(incomeDay(new Date("2026-12-01T07:30:00Z"))).toBe("2026-11-30");
    expect(incomeDay(new Date("2026-12-01T08:30:00Z"))).toBe("2026-12-01");
  });
});

describe("routing prices a gift in the same month the report lists it", () => {
  beforeEach(() => vi.useFakeTimers({ now: LATE_PACIFIC, toFake: ["Date"] }));
  afterEach(() => vi.useRealTimers());

  it("today() is October 31 at 11:30 PM Pacific, in the API, the gift page and the checkers", () => {
    expect(today()).toBe("2026-10-31");
    expect(envelopeToday()).toBe("2026-10-31");
    const plan = routeGift(120, [], today(), DEFAULT_PROFILE, "Lee's ABLE account");
    expect(monthOf(today())).toBe("2026-10");
    expect(plan.lines.length).toBeGreaterThan(0);
  });
});

describe("every surface puts the two gifts in October", () => {
  const s = subject();
  const october = buildReport({ name: s.name, profile: s.profile, gifts: s.gifts, month: "2026-10", today: "2026-11-02" });
  const november = buildReport({ name: s.name, profile: s.profile, gifts: s.gifts, month: "2026-11", today: "2026-11-02" });

  it("the receipt", () => {
    for (const at of [LATE_PACIFIC, EARLY_UTC]) {
      const m = receiptMoment([row(9, at)]);
      expect(m.date).toBe("2026-10-31");
      expect(monthOf(m.date)).toBe("2026-10");
    }
    expect(shownAt(receiptMoment([row(9, LATE_PACIFIC)]).at)).toBe("Oct 31, 2026, 11:30 PM PT");
  });

  it("the report and its check page's code", () => {
    expect(october.lines.map((l) => l.date)).toEqual(["2026-10-31", "2026-10-31"]);
    expect(november.lines).toHaveLength(0);
    expect(october.months.map((m) => m.month)).toEqual(["2026-10"]);
    // The verify page rebuilds this report from the same gifts, so its code names the October lines.
    expect(reportCode("lee", october)).toMatch(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/);
  });

  it("the CSV", () => {
    const rows = reportCsv(october).trim().split("\n").slice(1);
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.startsWith("2026-10-31,")).toBe(true);
  });

  it("Easy Read, in English and Spanish", () => {
    const gifts = easyRead(october, "en").sections.flatMap((x) => x.lines.map((l) => l.text)).filter((t) => /paid Riverside/.test(t));
    expect(gifts).toEqual(["On October 31, Dan paid Riverside Mobility $120.", "On October 31, Dan paid Riverside Mobility $120."]);
    expect(easyRead(october, "en").title).toMatch(/October/);
    expect(easyRead(october, "es").title.toLowerCase()).toMatch(/octubre/);
  });

  it("the MCP get_ssa_report tool", async () => {
    const { TOOLS } = await import("@/lib/mcp/tools");
    const t = TOOLS.find((x) => x.name === "get_ssa_report")!;
    const r = await t.run({ slug: "lee", month: "2026-10", view: "given", reader: "helper", lang: "en" } as never, { origin: "https://example.test" });
    const lines = (r.data as { lines: { date: string }[] }).lines;
    expect(lines.map((l) => l.date)).toEqual(["2026-10-31", "2026-10-31"]);
    const nov = await t.run({ slug: "lee", month: "2026-11", view: "given", reader: "helper", lang: "en" } as never, { origin: "https://example.test" });
    expect((nov.data as { lines: unknown[] }).lines).toHaveLength(0);
  });
});

describe("times shown to people: one zone, one format, the zone named", () => {
  it("formats an instant in Pacific time with PT, whatever the server's zone", () => {
    expect(shownAt(new Date("2026-11-09T01:02:05Z"))).toBe("Nov 8, 2026, 5:02 PM PT");
    expect(shownTime("2026-11-09T01:02:05Z")).toBe("5:02 PM PT");
    expect(shownTime("2026-11-09T01:02:05Z", { seconds: true })).toBe("5:02:05 PM PT");
    expect(ZONE_SHORT).toBe("PT");
  });

  it("formats a calendar day without moving it", () => {
    expect(shownDay("2026-10-31")).toBe("Oct 31");
    expect(shownDay("2026-11-01", { dateStyle: "long" })).toBe("November 1, 2026");
  });
});
