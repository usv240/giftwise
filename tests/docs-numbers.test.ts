import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import results from "../content/test-results.json";
import { API, MCP_TOOLS, PATH } from "../workflows/src/checks";
import { CASES } from "@/lib/cases/list";
import { IMPACT, sampleYearSplit } from "@/lib/impact";
import { R as BILL_RUN, refereeExample } from "@/lib/review/example";
import { usd } from "@/lib/rules";

/**
 * Every number the README and TESTING.md state about tests, checks, tools and dollars has one source: test counts in
 * content/test-results.json (written by scripts/test-results.mjs after the suites run), the outside checks and MCP
 * tools in the code that runs them, and the dollar figures in src/lib/impact.ts. These fail when a document disagrees.
 */
const readme = readFileSync("README.md", "utf8");
const testing = readFileSync("TESTING.md", "utf8");
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
  it("README's test table gives each suite the count test-results.json records", () => {
    let seen = 0;
    for (const s of results.suites) {
      for (const row of rows(readme, s.command)) {
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

  it("the README's design line counts the page views the accessibility suite checks", () => {
    expect(readme).toContain(`axe on ${n(suite("a11y").total)} page views`);
  });

  it("README and TESTING.md count the outside checks the workflow runs", () => {
    const total = CASES.length + PATH.length + API.length;
    expect(suite("outside").total).toBe(total);
    expect(readme).toContain(`(${total} in all)`);
    expect(readme).toContain(`the same ${total} outside checks`);
    expect(testing).toContain(`Workflow: ${total} checks`);
    expect(testing).toContain(`All ${total} checks, with each result`);
  });

  it("the README names as many MCP tools as the server lists", () => {
    expect(readme).toContain(`with ${WORDS[MCP_TOOLS.length]} tools`);
  });
});

describe("one source for every dollar figure", () => {
  it("the README leads with the court-case figures src/lib/impact.ts computes", () => {
    const top = readme.slice(0, readme.indexOf("## The problem in one number"));
    expect(top).toContain(`About ${usd(IMPACT.keptMonthlyPerPerson)} a month for each person`);
    expect(top).toContain(`In ${IMPACT.routedCases} of ${IMPACT.scoredCases} real SSI cases`);
    expect(top).toContain(cents(IMPACT.keptMonthly));
    expect(top).toContain(`${cents(IMPACT.askedBack)} asked back`);
  });

  it("the README splits the sample year the way the rules engine does", () => {
    const y = sampleYearSplit();
    expect(y.checkWhole).toBe(y.gifts);
    expect(y.paypal.amount + y.able.amount + y.item.amount + y.cash.amount).toBe(y.total);
    for (const text of [readme.slice(0, readme.indexOf("## The problem in one number")), readme.slice(readme.indexOf("## How this works for real"))]) {
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
    expect(readme).toContain(`sends the ${usd(BILL_RUN.amount)} to her ABLE account, where her check is ${usd(able.check)} either way (paid to the insurer, it could be ${usd(shop.check)})`);
  });
});
