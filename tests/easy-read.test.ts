import { describe, expect, it } from "vitest";
import sample from "../content/sample-year.json";
import { easyLines, easyRead, easySentences, reminderIcs } from "@/lib/report/easy";
import { buildReport, type ReportGift } from "@/lib/report/ssa";
import { DEFAULT_PROFILE, type Category, type Delivery } from "@/lib/rules";

type S = { date: string; giver: string; need: string; paidTo: string; delivery: Delivery; category: Category; amount: number; recurring: boolean };
const gifts: ReportGift[] = (sample.gifts as S[]).map((g, i) => ({ id: `s${i}`, ...g, evidence: { kind: "sample" } }));
const maya = { name: "Maya", profile: { ...DEFAULT_PROFILE, pronoun: "she" as const }, gifts, today: "2026-11-03" };
const months = [...new Set(gifts.map((g) => g.date.slice(0, 7)))];
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe("Easy Read report", () => {
  it("keeps every sentence to 15 words or fewer, in English and Spanish, for every month in both views", () => {
    let checked = 0;
    for (const month of months)
      for (const view of ["given", "cash"] as const)
        for (const lang of ["en", "es"] as const) {
          const e = easyRead(buildReport({ ...maya, month, view }), lang);
          for (const s of easySentences(e)) {
            expect(words(s), `${lang} ${month} ${view}: "${s}"`).toBeLessThanOrEqual(15);
            checked++;
          }
        }
    expect(checked).toBeGreaterThan(400);
  });

  it("uses no colons, semicolons or brackets anywhere a reader looks, and starts each sentence on its own line", () => {
    for (const month of months)
      for (const view of ["given", "cash"] as const)
        for (const lang of ["en", "es"] as const) {
          const e = easyRead(buildReport({ ...maya, month, view }), lang);
          for (const line of [...easyLines(e), e.title, e.ui.lede, ...e.sections.map((s) => s.title)]) expect(line, `${lang} ${month} ${view}`).not.toMatch(/[:;()[\]]/);
          for (const l of [...(e.whatIf ?? []), ...e.answer, ...e.sections.flatMap((s) => s.lines)]) expect(l.text.split(/(?<=[.?!])\s+/), `${lang} ${month} ${view}: "${l.text}"`).toHaveLength(1);
        }
  });

  it("explains an ABLE account the first time the page names one, and says what each shop or ABLE gift was for", () => {
    const en = easyRead(buildReport({ ...maya, month: "2026-10" }), "en");
    const lines = easyLines(en);
    const first = lines.findIndex((t) => /\bABLE\b/.test(t));
    expect(lines.slice(first + 1, first + 3)).toContain("An ABLE account is a savings account for people with disabilities.");
    expect(lines.filter((t) => t === "An ABLE account is a savings account for people with disabilities.")).toHaveLength(1);
    const records = en.sections.find((s) => s.id === "records")!.lines;
    expect(records.find((l) => l.text === "On October 8, Priya paid Horizon Wireless $65.")?.note).toBe("It is for the phone bill.");
    expect(records.find((l) => l.text === "On October 5, Lucy put $133 in your ABLE account.")?.note).toBe("It is for the electric bill.");
    const es = easyRead(buildReport({ ...maya, month: "2026-10" }), "es");
    expect(easyLines(es)).toContain("Una cuenta ABLE es una cuenta de ahorros para personas con discapacidad.");
  });

  it("October as given: no call needed, and her December check stays $994, in both languages", () => {
    const r = buildReport({ ...maya, month: "2026-10" });
    const en = easyRead(r, "en");
    expect(en.title).toBe("Your gifts in October 2026");
    expect(en.answer.map((l) => l.text)).toEqual(["You do not need to call Social Security about these gifts.", "Your SSI check in December stays $994."]);
    expect(en.script).toEqual([]);
    const es = easyRead(r, "es");
    expect(es.title).toBe("Sus regalos de octubre de 2026");
    expect(es.answer.map((l) => l.text)).toEqual(["No tiene que llamar al Seguro Social por estos regalos.", "Su cheque de SSI de diciembre sigue siendo $994."]);
    expect(es.sections.find((s) => s.id === "records")?.lines.some((l) => l.text === "El 5 de octubre, Lucy puso $133 en su cuenta ABLE.")).toBe(true);
  });

  it("October as cash: call by November 10, five gifts, and the same check the full report gives", () => {
    const r = buildReport({ ...maya, month: "2026-10", view: "cash" });
    const e = easyRead(r, "en");
    expect(e.answer[0].text).toBe("Call Social Security by November 10.");
    expect(e.answer[1].text).toBe("Tell them about 5 gifts.");
    expect(e.answer[2].text).toBe(`Your SSI check in December will be $${r.totals.check}.`);
    expect(e.script[0]).toBe("Hello. My name is Maya.");
    expect(e.script.at(-1)).toBe("That is all. I have the receipts.");
    expect(e.script).toHaveLength(2 + r.totals.tell + 1);
    expect(easyRead(r, "es").sections.find((s) => s.id === "call")?.lines[1].text).toBe("Para español, oprima 7.");
  });

  it("writes a calendar file with the due date, an alert three days before, and a monthly look on the 5th", () => {
    const r = buildReport({ ...maya, month: "2026-10" });
    const ics = reminderIcs(r, "en", "https://example.org/g/maya/report/easy?month=2026-10", "2026-11-03T12:00:00.000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261110");
    expect(ics).toContain("TRIGGER:-P3D");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261205");
    expect(ics).toContain("RRULE:FREQ=MONTHLY;BYMONTHDAY=5;COUNT=12");
    expect(ics).toContain("SUMMARY:Report day for October: nothing from Giftwise to report");
    expect(ics.split("\r\n").at(-2)).toBe("END:VCALENDAR");
    expect(reminderIcs(r, "es", "https://example.org", "2026-11-03T12:00:00.000Z")).toContain("oprima 7");
  });
});
