import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import results from "../content/test-results.json";
import { API, MCP_TOOLS, PATH } from "../workflows/src/checks";
import { CASES } from "@/lib/cases/list";
import held from "../content/eval/held-out-results.json";
import { ASKED_SENTENCE, FAMILY_SENTENCE, IMPACT, KEPT_SENTENCE, housingReach, payItYourself, sampleYearSentence, sampleYearSplit } from "@/lib/impact";
import { R as BILL_RUN, refereeExample } from "@/lib/review/example";
import { DEFAULT_PROFILE, checkMonthName, evaluateGift, usd } from "@/lib/rules";

/**
 * Every number the README, its docs/ pages and TESTING.md state about tests, checks, tools and dollars has one source: test counts in
 * content/test-results.json (written by scripts/test-results.mjs after the suites run), the outside checks and MCP
 * tools in the code that runs them, and the dollar figures in src/lib/impact.ts. These fail when a document disagrees.
 */
const readme = readFileSync("README.md", "utf8");
const testing = readFileSync("TESTING.md", "utf8");
/** The README's detail lives in docs/: the test table, the results, how it works for real, and everything inside. */
const tests = readFileSync("docs/tests.md", "utf8");
const resultsDoc = readFileSync("docs/results.md", "utf8");
const realWorld = readFileSync("docs/real-world.md", "utf8");
const inside = readFileSync("docs/inside.md", "utf8");
const measured = JSON.parse(readFileSync("content/public/page-measure.json", "utf8")) as { pages: { path: string; screens_1440x900: number; words_with_sections_open: number }[] };
const before = JSON.parse(readFileSync("content/public/page-measure-before.json", "utf8")) as typeof measured;
const n = (x: number) => x.toLocaleString("en-US");
const cents = (x: number) => x.toLocaleString("en-US", { style: "currency", currency: "USD" });
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const suite = (id: string) => results.suites.find((s) => s.id === id)!;
/** The rows of a document's test table whose command column (the one before the result) is this command. */
const rows = (doc: string, command: string) =>
  doc.split(/\r?\n/).filter((l) => {
    const cells = l.split("|");
    return l.startsWith("|") && cells.length >= 4 && cells[cells.length - 3].trim() === `\`${command}\``;
  });
const hasNumber = (text: string, x: number) => new RegExp(`(^|[^\\d,.])${n(x)}([^\\d,]|$)`).test(text);

describe("one source for every test number", () => {
  it("the test table in docs/tests.md gives each suite the count test-results.json records", () => {
    let seen = 0;
    for (const s of results.suites) {
      for (const row of rows(tests, s.command)) {
        expect(row, s.id).toContain(`${n(s.passed)} of ${n(s.total)}`);
        seen++;
      }
    }
    expect(seen).toBeGreaterThanOrEqual(10);
  });

  it("TESTING.md's table gives each suite the same count", () => {
    let seen = 0;
    for (const s of results.suites) {
      for (const row of rows(testing, s.command)) {
        expect(hasNumber(row, s.passed), `${s.id}: ${row}`).toBe(true);
        seen++;
      }
    }
    expect(seen).toBeGreaterThanOrEqual(9);
  });

  it("the design line counts the page views the accessibility suite checks", () => {
    expect(inside).toContain(`axe on ${n(suite("a11y").total)} page views`);
  });

  it("the screen counts in docs/inside.md are the measured ones", () => {
    const ev = measured.pages.find((p) => p.path === "/evidence")!;
    const was = before.pages.find((p) => p.path === "/evidence")!;
    expect(inside).toContain(`${ev.screens_1440x900} screens at 1440 by 900`);
    expect(inside).toContain(`${n(ev.words_with_sections_open)} words`);
    expect(inside).toContain(`${was.screens_1440x900} screens and ${n(was.words_with_sections_open)} words`);
  });

  it("README and TESTING.md count the outside checks the workflow runs", () => {
    const total = CASES.length + PATH.length + API.length;
    expect(suite("outside").total).toBe(total);
    expect(resultsDoc).toContain(`(${total} in all)`);
    expect(readme).toContain(`the same ${total} outside checks`);
    expect(testing).toContain(`Workflow: ${total} checks`);
    expect(testing).toContain(`All ${total} checks, with each result`);
  });

  it("the README names as many MCP tools as the server lists", () => {
    expect(readme).toContain(`with ${WORDS[MCP_TOOLS.length]} tools`);
  });
});

describe("one source for every dollar figure", () => {
  it("the README leads with the court-case figures src/lib/impact.ts computes, case by case", () => {
    const top = readme.slice(0, readme.indexOf("## The problem in one number"));
    expect(top).toContain(KEPT_SENTENCE);
    for (const k of [IMPACT.keptMin, IMPACT.keptMax]) expect(top).toContain(cents(k));
    for (const c of IMPACT.askedCases) expect(top).toContain(cents(c.amount));
    expect(top).toContain(`from ${IMPACT.keptFromYear} to ${IMPACT.keptToYear}`);
    expect(IMPACT.askedAvoidedThroughAble).toBe(IMPACT.askedBackCases);
    expect(resultsDoc).toContain(`$331 to $663`);
    expect(resultsDoc).toContain(cents(IMPACT.keptMonthly));
    expect(ASKED_SENTENCE).toContain(cents(IMPACT.askedCases[0].amount));
  });

  it("the README leads with what the engine keeps each family over the months its court case covers, then the sample year", () => {
    const top = readme.slice(0, readme.indexOf("## The problem in one number"));
    expect(top).toContain(FAMILY_SENTENCE);
    expect(IMPACT.familyTotal).toBe(38103.32);
    expect(top.indexOf(FAMILY_SENTENCE)).toBeLessThan(top.indexOf(KEPT_SENTENCE));
    const y = payItYourself();
    expect(top).toContain(`${y.monthsLowered} of her monthly checks, ${cents(y.totalLowered)} in all`);
    expect(sampleYearSentence()).toContain(cents(y.totalLowered));
    expect(resultsDoc).toContain(`${cents(IMPACT.familyTotal)} in all`);
  });

  it("the README's one-number example is what the Gift Checker shows for a gift made in November 2026", () => {
    const cash = evaluateGift({ id: "p", date: "2026-11-10", amount: 1000, delivery: "cash", category: "other" }, DEFAULT_PROFILE);
    const shop = evaluateGift({ id: "p", date: "2026-11-10", amount: 1000, delivery: "vendor", category: "equipment" }, DEFAULT_PROFILE);
    expect(readme).toContain(`her ${checkMonthName(cash.paymentMonth)} check drops from ${usd(cash.checkBaseline)} to ${usd(cash.checkAfter)}`);
    expect(readme).toContain(`leaves that ${checkMonthName(shop.paymentMonth)} check at ${usd(shop.checkAfter)}`);
    expect(readme).not.toContain("youtu.be");
  });

  it("the README's housing reach is the engine's, with and without ABLE", () => {
    const h = housingReach();
    const later = h.years[h.years.length - 1];
    expect(readme).toContain(`leaves her ${checkMonthName(later.paymentMonth)} check at ${usd(later.rentWithoutAble)} of ${usd(later.full)}, and through ABLE it stays ${usd(later.rentThroughAble)}`);
    expect(later.rentWithoutAble).toBeLessThan(later.full);
    expect(later.rentThroughAble).toBe(later.full);
  });

  it("the README and docs/results.md state the held-out result as recorded", () => {
    expect(readme).toContain(`**${held.summary.engine_matches} of ${held.summary.cases} examples the engine never saw**`);
    expect(readme).toContain(`commit \`${held.engine.commit}\``);
    expect(resultsDoc).toContain(`It matches ${held.summary.engine_matches} of ${held.summary.cases}.`);
    expect(resultsDoc).toContain(`frozen at commit \`${held.engine.commit}\``);
  });

  it("the README and docs/real-world.md answer why not pay the shop yourself with the engine's figures", () => {
    const y = payItYourself();
    for (const doc of [readme, realWorld]) {
      expect(doc).toContain(`${y.monthsLowered} of her monthly checks, ${cents(y.totalLowered)} in all`);
      expect(doc).toContain(usd(y.ableLimit));
    }
    expect(realWorld).toContain(`${y.housingGifts} of the ${y.gifts} gifts (${usd(y.housingAmount)})`);
    expect(realWorld).toContain(`${y.cashGifts} gifts (${usd(y.cashAmount)})`);
    expect(realWorld).toContain(`${y.reportMonthsAlone} months with income or housing help to tell Social Security about, against ${y.reportMonthsGiftwise}`);
  });

  it("the README splits the sample year the way the rules engine does", () => {
    const y = sampleYearSplit();
    expect(y.checkWhole).toBe(y.gifts);
    expect(y.paypal.amount + y.able.amount + y.item.amount + y.cash.amount).toBe(y.total);
    for (const text of [readme.slice(0, readme.indexOf("## The problem in one number")), realWorld]) {
      expect(text).toContain(`${y.gifts} gifts`);
      expect(text).toContain(usd(y.total));
      expect(text).toContain(`${usd(y.paypal.amount)} (${y.paypal.gifts} gifts)`);
      expect(text).toContain(`${usd(y.able.amount)} (${y.able.gifts} gifts)`);
      expect(text).toContain(`${usd(y.item.amount)} is a jacket`);
    }
  });

  it("the README's referee example is what the referee code decides", () => {
    const { decided, routed, shop, able } = refereeExample();
    expect(decided.agreed).toBe(false);
    expect(decided.votes.every((v) => v.valid)).toBe(true);
    expect(new Set(decided.votes.map((v) => v.answer))).toEqual(new Set(["shelter", "not_shelter"]));
    expect(routed.route).toBe("able");
    expect(able.check).toBeGreaterThan(shop.check);
    expect(resultsDoc).toContain(`sends the ${usd(BILL_RUN.amount)} to her ABLE account, where her ${checkMonthName(able.paymentMonth)} check is ${usd(able.check)} either way (paid to the insurer, it could be ${usd(shop.check)})`);
  });
});
