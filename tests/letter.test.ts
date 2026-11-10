import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetReplayCount } from "@/lib/ai/claude";
import { answersFromLetter, holdsPrivate, letterResult, quoteFound, readLetter, type Letter } from "@/lib/ai/letter";
import { pdfText } from "@/lib/ai/pdf-text";
import { SAMPLE_LETTER, sampleLetterFile } from "@/lib/ai/sample-letter";
import { POST as readLetterRoute } from "@/app/api/v1/read-letter/route";

/**
 * "Read her letter from Social Security": the sample letter (made up for the demo, and marked so on the page) read on
 * Claude's recorded answer with no key, the rules engine's check against the payment it states, the quote check against
 * the PDF's own text, and nothing private coming back.
 */
describe("the sample letter reads on Claude's recorded answer, with no key", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("AI_CACHE_DIR", "");
    vi.stubEnv("DATABASE_URL", "");
    resetReplayCount();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("the PDF: Sam's facts, a payment that matches the rules engine's check, and every quote found in the letter's text", async () => {
    const { bytes, prepared } = await sampleLetterFile("pdf");
    const r = await readLetter(prepared);
    expect(r.replayed).toBe(true);
    const out = letterResult(r.data, await pdfText(bytes), "he");
    expect(out.answers).toMatchObject({ home: "other", benefits: 600 });
    expect(out.check).toMatchObject({ month: "2027-01", letterSays: 106, answersGive: 106, matches: true, plain: "Matches his letter: $106 for January 2027." });
    expect(out.quotes.text_layer).toBe(true);
    expect(out.quotes.checked).toBeGreaterThanOrEqual(4);
    expect(out.quotes.found).toBe(out.quotes.checked);
  });

  it("the photo reads the same facts; with no text layer its quotes are shown unchecked", async () => {
    const { prepared } = await sampleLetterFile("png");
    const r = await readLetter(prepared);
    expect(r.replayed).toBe(true);
    const out = letterResult(r.data, null, "he");
    expect(out.answers).toMatchObject({ home: "other", benefits: 600 });
    expect(out.check.matches).toBe(true);
    expect([out.quotes.text_layer, out.quotes.checked]).toEqual([false, 0]);
  });

  it("never returns the letter's claim number, address or date of birth", async () => {
    for (const kind of ["pdf", "png"] as const) {
      const out = letterResult((await readLetter((await sampleLetterFile(kind)).prepared)).data, null);
      const text = JSON.stringify(out);
      expect(text, kind).not.toMatch(/000-00-0000|Example Lane|00000|April 3, 1994|1994/);
    }
  });

  it("POST /api/v1/read-letter: the sample PDF read, checked and returned, with nothing stored", async () => {
    const { bytes } = await sampleLetterFile("pdf");
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), SAMPLE_LETTER.pdf);
    form.append("pronoun", "he");
    const res = await readLetterRoute(new Request("http://localhost/api/v1/read-letter", { method: "POST", body: form }));
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j.meta.replayed).toBe(true);
    expect(j.data).toMatchObject({ stored: false, answers: { home: "other", benefits: 600 }, profile: { livesInAnothersHousehold: true, otherUnearnedMonthly: 600 }, check: { matches: true, answersGive: 106 } });
    expect(j.data.quotes.found).toBe(j.data.quotes.checked);
  });

  it("any other letter still needs the key, and says the questions work without it", async () => {
    const form = new FormData();
    form.append("file", new Blob([Buffer.from("%PDF-1.4 not the sample")], { type: "application/pdf" }), "other.pdf");
    const res = await readLetterRoute(new Request("http://localhost/api/v1/read-letter", { method: "POST", body: form }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.message).toMatch(/questions work without it/);
  });
});

describe("what a reading may return", () => {
  it("a Social Security or claim number, an address or a date of birth marks a quote private", () => {
    for (const s of ["Claim number: 123-45-6789A", "SSN 123 45 6789", "Date of birth: May 2, 1990", "We mailed it to 42 Oak Street.", "Springfield, IL 62704", "Your BNC is on page 2"]) expect(holdsPrivate(s), s).toBe(true);
    for (const s of ["Beginning January 2027, the amount you will receive each month is $106.00.", "We counted Social Security benefits of $600.00 a month.", "Call 1-800-772-1213."]) expect(holdsPrivate(s), s).toBe(false);
  });

  it("a private quote is set aside, and counted as set aside", () => {
    const l: Letter = {
      is_ssa_letter: true,
      ssi_payment: { amount: 106, month: "2027-01", quote: "Claim number 123-45-6789A: your payment is $106.00." },
      other_income: [{ kind: "social_security", monthly_amount: 600, quote: "We counted Social Security benefits of $600.00 a month." }],
      wages: { monthly_amount: null, quote: null },
      living_arrangement: { in_anothers_household: null, gets_all_meals: null, quote: null },
      couple: { is_couple: null, quote: null },
      explanation: { plain: "A notice about SSI payments.", technical: "" },
    };
    const out = letterResult(l, "We counted Social Security benefits of $600.00 a month.");
    expect(out.letter.ssi_payment.quote).toBeNull();
    expect(out.quotes).toMatchObject({ set_aside: 1, checked: 1, found: 1 });
    expect(answersFromLetter(l)).toEqual({ benefits: 600 });
  });

  it("a quote is found in the text however the PDF broke its lines, and not found when it is not there", () => {
    const text = "Beginning January 2027, the amount you will receive each\nmonth is $106.00. We counted Social Security bene fits of $600.00 a month.";
    expect(quoteFound("Beginning January 2027, the amount you will receive each month is $106.00.", text)).toBe(true);
    expect(quoteFound("We counted Social Security benefits of $600.00 a month.", text)).toBe(true);
    expect(quoteFound("We counted wages of $400.00 a month.", text)).toBe(false);
    expect(quoteFound("Anything", null)).toBeNull();
  });
});
