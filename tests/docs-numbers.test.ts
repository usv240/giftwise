import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import results from "../content/test-results.json";
import { API, MCP_TOOLS, PATH } from "../workflows/src/checks";
import { CASES } from "@/lib/cases/list";
import held from "../content/eval/held-out-results.json";
import heldOutSet from "../content/eval/held-out.json";
import held2 from "../content/eval/held-out-2-results.json";
import { ASKED_SENTENCE, FAMILY_BASIS, FAMILY_SENTENCE, IMPACT, KEPT_SENTENCE, housingReach, payItYourself, paypalShareSentence, sampleYearSentence, sampleYearSplit } from "@/lib/impact";
import { R as BILL_RUN, refereeExample } from "@/lib/review/example";
import { DEFAULT_PROFILE, checkMonthName, evaluateGift, usd } from "@/lib/rules";
import held2Set from "../content/eval/held-out-2.json";
import { heldOut2AfterFix, type HeldOutCase } from "@/lib/held-out";
import * as rules from "@/lib/rules";

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

  it("the Postman request count is one number, counted from the collection", () => {
    const pm = suite("postman") as { requests?: number; command: string; what: string };
    const collection = JSON.parse(readFileSync("postman/giftwise.postman_collection.json", "utf8")) as { item: unknown[] };
    const count = (items: unknown[]): number => items.reduce<number>((s, i) => s + ((i as { request?: unknown }).request ? 1 : 0) + count(((i as { item?: unknown[] }).item ?? []) as unknown[]), 0);
    expect(pm.requests).toBe(count(collection.item));
    for (const [doc, name] of [[tests, "docs/tests.md"], [testing, "TESTING.md"]] as const) {
      const row = rows(doc, pm.command);
      expect(row, name).toHaveLength(1);
      expect(row[0], name).toContain(`${pm.requests} requests`);
    }
    expect(pm.what.startsWith(`${pm.requests} requests`)).toBe(true);
    expect(inside).toContain(`${pm.requests} requests`);
  });

  it("the README states the unit counts a reader sees with nothing set and with everything set", () => {
    type Run = { passed: number; skipped: number; failed: number; needs: { database: number; claude: number; paypal: number } };
    const unit = suite("unit") as { command: string; passed: number; total: number; bare?: Run; with_database?: Run };
    expect(unit.bare, "scripts/test-results.mjs unit records the bare run").toBeDefined();
    const bare = unit.bare!;
    // Every test is counted once; a failure here would show in the full count, which must be whole.
    expect(bare.passed + bare.skipped + bare.failed).toBe(unit.total);
    expect(bare.needs.database + bare.needs.claude + bare.needs.paypal).toBe(bare.skipped);
    const line = `${bare.passed} pass and ${bare.skipped} skip`;
    expect(readme).toContain(line);
    expect(readme).toContain(`${bare.needs.database} need a database`);
    // The with-database count is the run that read .env.local, as it ran: whole only when the database answered.
    const w = unit.with_database!;
    expect(w, "scripts/test-results.mjs unit records the run with .env.local").toBeDefined();
    expect([w.passed, w.passed + w.skipped + w.failed]).toEqual([unit.passed, unit.total]);
    expect(readme).toContain(
      w.skipped === 0
        ? `when .env.local names a reachable database: ${n(unit.passed)} of ${n(unit.total)}, no keys needed`
        : `with .env.local: ${n(w.passed)} of ${n(unit.total)}, ${w.skipped} skipped because the database did not answer`,
    );
    expect(rows(tests, unit.command)[0]).toContain(line);
    expect(rows(testing, unit.command)[0]).toContain(line);
  });

  it("the browser suite's count and its one skip reason read the same in the README, docs/tests.md, TESTING.md and the suite", () => {
    const ui = suite("ui");
    const why = /const SKIP_WHY = "([^"]+)"/.exec(readFileSync("tests/e2e/ui.mjs", "utf8"))?.[1];
    expect(why).toBeTruthy();
    const sentence = `Claude's four document steps run live with a key and on its recorded answers without one, and skip only when ${why}`;
    expect(readme).toContain(`\`npm run e2e:ui\`, ${ui.passed} of ${ui.total} (${sentence})`);
    expect(rows(tests, ui.command)[0]).toContain(sentence);
    expect(rows(testing, ui.command)[0]).toContain(sentence);
    for (const doc of [readme, tests, testing]) expect(doc).not.toMatch(/AG Studio widget steps|three steps where Claude reads/);
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

  it("the two long evidence pages open short, measured before and after", () => {
    const m = measured as typeof measured & { previous?: { pages: typeof measured.pages } };
    expect(m.previous, "scripts/measure-pages.mjs keeps the run it replaced").toBeDefined();
    for (const path of ["/evidence/impact", "/evidence/rules"]) {
      const now = m.pages.find((p) => p.path === path)! as (typeof m.pages)[number] & { words_shown: number };
      const then = m.previous!.pages.find((p) => p.path === path)! as typeof now;
      expect(now.screens_1440x900, path).toBeLessThan(then.screens_1440x900);
      expect(inside).toContain(`\`${path}\` opens at ${now.screens_1440x900} screens and ${n(now.words_shown)} words shown, against ${then.screens_1440x900} and ${n(then.words_shown)} before`);
    }
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
  it("docs/results.md states the court-case figures src/lib/impact.ts computes, case by case", () => {
    expect(resultsDoc).toContain(KEPT_SENTENCE.replace(/\.$/, ""));
    for (const k of [IMPACT.keptMin, IMPACT.keptMax]) expect(resultsDoc).toContain(cents(k));
    for (const c of IMPACT.askedCases) expect(resultsDoc).toContain(cents(c.amount));
    expect(resultsDoc).toContain(`from ${IMPACT.keptFromYear} to ${IMPACT.keptToYear}`);
    expect(IMPACT.askedAvoidedThroughAble).toBe(IMPACT.askedBackCases);
    expect(resultsDoc).toContain(`$331 to $663`);
    expect(resultsDoc).toContain(cents(IMPACT.keptMonthly));
    expect(ASKED_SENTENCE).toContain(cents(IMPACT.askedCases[0].amount));
  });

  it("the README's dollar section is the three sentences the engine computes, below Results, with the counterfactual labelled", () => {
    const dollars = readme.slice(readme.indexOf("## What it changes, in dollars"), readme.indexOf("## What is at stake"));
    expect(readme.indexOf("## Results")).toBeLessThan(readme.indexOf("## What it changes, in dollars"));
    expect(dollars).toContain(FAMILY_SENTENCE);
    expect(dollars).toContain(FAMILY_BASIS);
    expect(dollars).toContain(sampleYearSentence());
    expect(IMPACT.familyTotal).toBe(38103.32);
    // The result strip above leads with the per-month range, then the two-family total over the same months.
    const strip = readme.slice(readme.indexOf("## Results"), readme.indexOf("## Where to look"));
    const whole = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;
    expect(strip).toContain(`| **${whole(IMPACT.keptMin)} to ${whole(IMPACT.keptMax)} a month** |`);
    // What the cases mean leads (family help counted against the person in every one), then how many routing keeps money in.
    expect(IMPACT.countedCases).toBe(IMPACT.scoredCases);
    expect(strip).toContain(`help from family was counted against the person in all ${IMPACT.countedCases} real SSI court cases; routed through Giftwise, the same help keeps this in ${IMPACT.routedCases} of the ${IMPACT.scoredCases}`);
    expect(strip).toContain(`keeps money in all ${IMPACT.keptIfAbleCases} with stated amounts if the person can open an ABLE account`);
    expect(IMPACT.keptIfAbleCases).toBe(IMPACT.computedCases);
    expect(strip).toContain(`**${cents(IMPACT.familyTotal)}** over the ${IMPACT.familyCases.map((c) => c.months).join(" and ")} months`);
    expect(resultsDoc).toContain(`${cents(IMPACT.familyTotal)} in all`);
  });

  it("the README stays short enough to read in one sitting", () => {
    // Words as rendered: link targets and image paths are not read, so they are not counted.
    const shown = readme.replace(/\]\([^)]*\)/g, "]");
    const words = shown.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
    expect(words).toBeLessThan(2000);
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
    // Both documents carry the first run's result and say that two expected answers were corrected afterwards, with the reasons in the set.
    const firstRun = `${held.first_run.engine_matches} of ${held.first_run.cases}`;
    expect(readme).toContain(`The first run matched ${firstRun}; two expected answers were then corrected`);
    expect(readme).toContain("content/eval/held-out.json");
    expect(resultsDoc).toContain(`corrected after the first run (${firstRun})`);
    expect(heldOutSet.corrections).toHaveLength(2);
    // The second set, written before its run: its result and the blob that ran, in both documents.
    expect(readme).toContain(`**${held2.summary.engine_matches} of ${held2.summary.cases} in a second set written before its run**`);
    expect(readme).toContain(`git blob \`${held2.set.git_blob.slice(0, 7)}\``);
    expect(readme).toContain(`frozen at \`${held2.engine.commit}\``);
    expect(resultsDoc).toContain(`It matches ${held2.summary.engine_matches} of ${held2.summary.cases}`);
    expect(resultsDoc).toContain(`(\`${held2.set.git_blob.slice(0, 7)}\`)`);
    // The current engine on the second set after the fix, labelled as not a held-out result, from src/lib/held-out.ts.
    const after = heldOut2AfterFix(held2Set.cases as unknown as HeldOutCase[], rules);
    expect(resultsDoc).toContain("**After the fix, not a held-out result.**");
    expect(resultsDoc).toContain(`On the same ${WORDS[after.asWritten.cases]} as written, the current engine matches ${after.asWritten.matches} of ${after.asWritten.cases}.`);
    expect(resultsDoc).toContain(`The other ${WORDS[after.asWritten.misses.length]} turn on a fact the engine had no field for`);
    expect(resultsDoc).toContain(`in the new field, ${after.withFields.matches} of ${after.withFields.cases}`);
  });

  it("docs/real-world.md answers why not pay the shop yourself with the engine's figures", () => {
    const y = payItYourself();
    expect(realWorld).toContain(`${y.monthsLowered} of her monthly checks, ${cents(y.totalLowered)} in all`);
    expect(realWorld).toContain(usd(y.ableLimit));
    expect(sampleYearSentence()).toContain(cents(y.totalLowered));
    expect(realWorld).toContain(`${y.housingGifts} of the ${y.gifts} gifts (${usd(y.housingAmount)})`);
    expect(realWorld).toContain(`${y.cashGifts} gifts (${usd(y.cashAmount)})`);
    expect(realWorld).toContain(`${y.reportMonthsAlone} months with income or housing help to tell Social Security about, against ${y.reportMonthsGiftwise}`);
  });

  it("the README and /about state PayPal's share of the sample year as the engine splits it", () => {
    const y = sampleYearSplit();
    const pct = Math.round((y.paypal.amount / y.total) * 100);
    expect(paypalShareSentence()).toBe(`PayPal carries ${pct} percent of the sample year's dollars today: ${usd(y.paypal.amount)} of ${usd(y.total)}, everything paid to shops and clinics.`);
    expect(readme).toContain(paypalShareSentence());
    expect(readFileSync("src/app/about/page.tsx", "utf8")).toContain("{paypalShareSentence()}");
    expect(realWorld).toContain(`${usd(y.paypal.amount)} (${y.paypal.gifts} gifts)`);
  });

  it("docs/real-world.md splits the sample year the way the rules engine does", () => {
    const y = sampleYearSplit();
    expect(y.checkWhole).toBe(y.gifts);
    expect(y.paypal.amount + y.able.amount + y.item.amount + y.cash.amount).toBe(y.total);
    expect(realWorld).toContain(`${y.gifts} gifts`);
    expect(realWorld).toContain(usd(y.total));
    expect(realWorld).toContain(`${usd(y.paypal.amount)} (${y.paypal.gifts} gifts)`);
    expect(realWorld).toContain(`${usd(y.able.amount)} (${y.able.gifts} gifts)`);
    expect(realWorld).toContain(`${usd(y.item.amount)} is a jacket`);
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
