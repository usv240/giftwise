import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import results from "../content/test-results.json";
import { API, MCP_TOOLS, PATH } from "../workflows/src/checks";
import { CASES } from "@/lib/cases/list";
import held from "../content/eval/held-out-results.json";
import heldOutSet from "../content/eval/held-out.json";
import held2 from "../content/eval/held-out-2-results.json";
import { ASKED_SENTENCE, COURT_NOT_INCOME, COURT_SCORE, FAMILY_BASIS, FAMILY_SENTENCE, IMPACT, KEPT_SENTENCE, housingReach, payItYourself, paypalShareSentence, sampleYearSentence, sampleYearSplit } from "@/lib/impact";
import ssaSet from "../content/eval/ssa-examples.json";
import fieldRun from "../content/eval/field-cases-results.json";
import secondClass from "../content/eval/field-cases-2-results.json";
import { whatAiAdds } from "@/lib/review/what-ai-adds";
import { ADVERSARIAL_BILL, adversarialAlone } from "@/lib/review/adversarial";
import { R as BILL_RUN, refereeExample } from "@/lib/review/example";
import { DEFAULT_PROFILE, addMonths, checkMonthName, evaluateGift, monthOf, usd } from "@/lib/rules";
import held2Set from "../content/eval/held-out-2.json";
import held3 from "../content/eval/held-out-3-results.json";
import held3Set from "../content/eval/held-out-3.json";
import held4 from "../content/eval/held-out-4-results.json";
import held4Set from "../content/eval/held-out-4.json";
import invariantRun from "../content/eval/invariants-results.json";
import { INVARIANTS } from "@/lib/invariants";
import { HELD_OUT_4_NEW_FIELDS, heldOut2AfterFix, heldOut3AfterFix, heldOut4AfterFix, type HeldOutCase } from "@/lib/held-out";
import * as rules from "@/lib/rules";
import ssaRun from "../content/eval/ssa-examples-results.json";
import { SAMPLE, pageProfile } from "@/lib/households";
import { routeGift, type OpenNeed } from "@/lib/routing";

/**
 * Every number the README, its docs/ pages and TESTING.md state about tests, checks, tools and dollars has one source: test counts in
 * content/test-results.json (written by scripts/test-results.mjs after the suites run), the outside checks and MCP
 * tools in the code that runs them, the evaluation results in content/eval, and the dollar figures in src/lib/impact.ts.
 * These fail when a document disagrees.
 */
const readme = readFileSync("README.md", "utf8");
/** One `## ` section of a Markdown document, from its heading to the next one. */
const section = (doc: string, heading: string) => {
  const from = doc.indexOf(`\n${heading}\n`);
  expect(from, heading).toBeGreaterThanOrEqual(0);
  const next = doc.indexOf("\n## ", from + heading.length + 1);
  return doc.slice(from, next < 0 ? undefined : next);
};
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
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen"];
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

  it("the README states the unit counts a fresh clone sees, and docs/tests.md the count with a database", () => {
    type Run = { passed: number; skipped: number; failed: number; needs: { database: number; claude: number; paypal: number } };
    const unit = suite("unit") as { command: string; passed: number; total: number; bare?: Run; with_database?: Run };
    expect(unit.bare, "scripts/test-results.mjs unit records the bare run").toBeDefined();
    const bare = unit.bare!;
    // Every test is counted once; a failure here would show in the full count, which must be whole.
    expect(bare.passed + bare.skipped + bare.failed).toBe(unit.total);
    expect(bare.needs.database + bare.needs.claude + bare.needs.paypal).toBe(bare.skipped);
    const line = `${bare.passed} pass and ${bare.skipped} skip`;
    // The README's one test line: what `npm test` does in a fresh clone with no keys (scripts/test-results.mjs rewrites it).
    expect(readme).toContain(`no keys needed: a fresh clone runs ${line} (${bare.needs.database} need a database)`);
    // The with-database count is the run that read .env.local, as it ran: claimed only when the database answered.
    const w = unit.with_database!;
    expect(w, "scripts/test-results.mjs unit records the run with .env.local").toBeDefined();
    expect([w.passed, w.passed + w.skipped + w.failed]).toEqual([unit.passed, unit.total]);
    const row = rows(tests, unit.command)[0];
    expect(row).toContain(
      w.skipped === 0
        ? `${n(unit.passed)} of ${n(unit.total)} when \`.env.local\` names a reachable database`
        : `${n(w.passed)} of ${n(unit.total)} with \`.env.local\`, ${w.skipped} skipped because the database did not answer`,
    );
    expect(row).toContain(line);
    expect(rows(testing, unit.command)[0]).toContain(line);
  });

  it("the browser suite's count and its one skip reason read the same in docs/tests.md, TESTING.md and the suite", () => {
    const ui = suite("ui");
    const why = /const SKIP_WHY = "([^"]+)"/.exec(readFileSync("tests/e2e/ui.mjs", "utf8"))?.[1];
    expect(why).toBeTruthy();
    const sentence = `Claude's four document steps run live with a key and on its recorded answers without one, and skip only when ${why}`;
    expect(rows(tests, ui.command)[0]).toContain(`${ui.passed} of ${ui.total}`);
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

  it("the three evidence pages open short, measured before and after", () => {
    type Page = (typeof measured.pages)[number] & { words_shown: number; before?: { screens_1440x900: number; words_shown: number } };
    for (const path of ["/evidence", "/evidence/impact", "/evidence/rules"]) {
      const now = measured.pages.find((p) => p.path === path)! as Page;
      // scripts/measure-pages.mjs keeps each page's measurement from before its last change.
      const then = now.before!;
      expect(then, `${path} has a before`).toBeDefined();
      expect(now.screens_1440x900, path).toBeLessThan(then.screens_1440x900);
      expect(inside).toContain(`\`${path}\` opens at ${now.screens_1440x900} screens and ${n(now.words_shown)} words shown, against ${then.screens_1440x900} and ${n(then.words_shown)} before`);
    }
  });

  it("README and TESTING.md count the outside checks the workflow runs", () => {
    const total = CASES.length + PATH.length + API.length;
    expect(suite("outside").total).toBe(total);
    expect(resultsDoc).toContain(`(${total} in all)`);
    expect(readme).toContain(`a Render Workflow runs ${total} outside checks on the live site`);
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

  it("the README's Results are the figures the code computes, one per line, with the counterfactual labelled", () => {
    const strip = section(readme, "## Results");
    const whole = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;
    // SSA's own worked examples, from the recorded run: the engine, and Claude with no rulebook.
    expect(strip).toContain(`- **${ssaRun.summary.engine_matches} of ${ssaRun.summary.cases}** of Social Security's own worked examples match SSA's answer; Claude with no rulebook, ${ssaRun.summary.claude_matches} of ${ssaRun.summary.cases}`);
    // The court cases: the score, led by what it shows, and what the rest turn on.
    const S = fieldRun.summary;
    expect(S.agreed).toBe(S.scored);
    expect(strip).toContain(`- **${COURT_SCORE}:** every federal court case that turns on whether a gift counts reaches SSA's and the court's outcome; the other ${S.not_scored} turn on`);
    // The engine's counterfactual on those cases, in dollars, labelled as one.
    expect(IMPACT.countedCases).toBe(IMPACT.scoredCases);
    expect(IMPACT.keptIfAbleCases).toBe(IMPACT.computedCases);
    expect(strip).toContain(
      `- **${whole(IMPACT.keptMin)} to ${whole(IMPACT.keptMax)} a month.** Family help was counted against the person in all ${IMPACT.countedCases} scored court cases; routed through Giftwise, it keeps money in ${IMPACT.routedCases}, and in ${IMPACT.keptIfAbleCases} with an ABLE account. The engine's counterfactual at 2026 rates, not an observed outcome`,
    );
    // The random-gift run: its size and the number of promises each gift is held to.
    expect(strip).toContain(`- **${n(invariantRun.gifts)} random gifts** each keep all ${WORDS[INVARIANTS.length]} promises`);
    // Each result line is one figure: no line carries a table cell's stack of qualified lines.
    for (const line of strip.split(/\r?\n/).filter((l) => l.startsWith("- **"))) expect(line, line.slice(0, 40)).not.toContain("<br>");
  });

  it("the figures the README leaves to the docs are stated there, as the code computes them", () => {
    // The per-family court figures, in docs/results.md.
    expect(resultsDoc).toContain(FAMILY_SENTENCE);
    expect(resultsDoc).toContain(FAMILY_BASIS);
    expect(IMPACT.familyTotal).toBe(38103.32);
    expect(resultsDoc).toContain(`${cents(IMPACT.familyTotal)} in all`);
    // The sample year against each giver paying on their own, in docs/real-world.md.
    expect(realWorld).toContain(sampleYearSentence());
    // The second class of court cases (each one a loan), first run and after the fix, in docs/results.md (held below).
    expect(secondClass.cases.every((c) => /loan/i.test(c.determination.held))).toBe(true);
    expect(resultsDoc).toContain(`On its first run, before the engine had a loan field, the engine agreed on ${COURT_NOT_INCOME.score}.`);
    // The groups of SSA's examples kept out of the score, each with its reason in the set.
    expect(ssaSet.out_of_scope.length).toBe(ssaRun.summary.out_of_scope_groups);
    expect(resultsDoc).toContain(`${ssaSet.out_of_scope.length} groups of SSA's examples are listed apart and not scored`);
  });

  it("the README's three-minute test is the split the router makes on Maya's page", () => {
    const needs: OpenNeed[] = SAMPLE.needs.map((x, i) => ({ id: i + 1, title: x.title, category: x.category, route: x.route, payeeName: x.payeeName, payeeAccount: x.payeeAccount, amount: Number(x.amount), funded: 0, recurring: x.recurring }));
    const r = routeGift(1500, needs, "2026-11-10", pageProfile({ household: { profile: SAMPLE.profile }, payments: [] }));
    expect(r.unplaced).toBe(0);
    // One amount per payee, in the order the page lists them; the ABLE account's lines (the bill and savings) added together.
    const byPayee = new Map<string, number>();
    for (const l of r.lines) byPayee.set(l.payeeName, (byPayee.get(l.payeeName) ?? 0) + l.amount);
    const [shop1, shop2, able, shop3] = [...byPayee.entries()];
    expect(able[0]).toBe("Maya's ABLE account");
    const step = section(readme, "## Test it");
    expect(step).toContain(`four payees (${usd(shop1[1])}, ${usd(shop2[1])}, ${usd(able[1])} to her ABLE account, ${usd(shop3[1])})`);
    expect(byPayee.size).toBe(4);
    expect(step).toContain(`her check two months later stays ${usd(r.checkWithRouting)} (the ${addMonths(monthOf("2026-11-10"), 2).slice(0, 4)} amount); as cash it would be ${usd(r.checkIfCash)}`);
    expect(r.checkWithRouting).toBe(r.baseline);
  });

  it("the README stays short enough to read in one sitting", () => {
    // Words as rendered: link targets and image paths are not read, so they are not counted.
    const shown = readme.replace(/\]\([^)]*\)/g, "]");
    const words = shown.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
    expect(words).toBeLessThan(2000);
  });

  it("the What the AI adds tables in docs/results.md, and the README's summary of them, are the code's", () => {
    const ai = resultsDoc.slice(resultsDoc.indexOf("### What the AI adds, measured"), resultsDoc.indexOf("## The two errors that cost money"));
    const summaries = section(readme, "## Results").split(/\r?\n/).filter((l) => l.includes("AI reviewers"));
    expect(summaries).toHaveLength(1);
    const [summary] = summaries;
    const t = whatAiAdds();
    const [none, regs, poms, ref] = t.columns;
    const row = (k: string, f: (c: typeof none) => string) => `| ${k} | ${[none, regs, poms, ref].map(f).join(" | ")} |`;
    expect(ai).toContain(row("Her check kept whole", (c) => `${c.whole} of ${t.bills}`));
    expect(ai).toContain(row("Wrong routes accepted", (c) => String(c.wrong)));
    expect(ai).toContain(row(`Settled with nothing left for her to do: paid straight to the business, of the ${t.payable} that are not housing`, (c) => `${c.direct} of ${t.payable}`));
    // docs/results.md says it in full: the router with no AI is as safe as the referee, and the AI adds settling bills.
    expect(ai).toContain(`keeps her check whole on ${none.whole} of ${t.bills} bills with ${none.wrong} wrong routes, the same as the referee`);
    expect(ai).toContain(`the referee pays ${ref.direct} of the ${t.payable} bills that are not housing straight to the business`);
    // The README's one line: bills settled with and without the AI, and her check whole on every bill either way.
    expect(summary).toContain(`**${ref.direct} of ${t.payable} bills settled by the two AI reviewers, against ${none.direct} of ${t.payable} with no AI,** her check whole on ${ref.whole} of ${t.bills} bills either way`);
    expect([none.whole, ref.whole]).toEqual([t.bills, t.bills]);
    // The design's reason holds only while the data shows it: no AI as safe, the manual reviewer alone settling more.
    expect(none.whole === ref.whole && none.wrong === ref.wrong).toBe(true);
    expect(poms.direct).toBeGreaterThan(ref.direct);
    const a = adversarialAlone();
    const labels = [
      ["Regulations reviewer alone, its quote checked", "regs"],
      ["Manual reviewer alone, its quote checked", "poms"],
      ["Regulations reviewer alone, its answer taken as sent", "regsUnchecked"],
      ["Manual reviewer alone, its answer taken as sent", "pomsUnchecked"],
      ["Both reviewers and the referee", "referee"],
    ] as const;
    for (const [label, k] of labels) expect(ai).toContain(`| ${label} | ${a[k].whole} of ${a.cases} |`);
    expect(summary).toContain(`On ${WORDS[a.cases]} adversarial cases, the referee keeps it whole on ${a.referee.whole} of ${a.cases} and the manual reviewer alone on ${a.poms.whole} of ${a.cases}`);
    expect(a.regs.whole).toBe(a.referee.whole);
    expect(a.poms.wrong).toEqual(["disagree"]);
    const low = a.rows.find((r) => r.id === "disagree")!.outcome.poms.check;
    expect(ai).toContain(`her ${checkMonthName(addMonths(monthOf(ADVERSARIAL_BILL.date), 2))} check drops from ${usd(a.full)} to ${usd(low)}`);
  });

  it("the README's one-number example is what the Gift Checker shows for a gift made in November 2026", () => {
    const cash = evaluateGift({ id: "p", date: "2026-11-10", amount: 1000, delivery: "cash", category: "other" }, DEFAULT_PROFILE);
    const shop = evaluateGift({ id: "p", date: "2026-11-10", amount: 1000, delivery: "vendor", category: "equipment" }, DEFAULT_PROFILE);
    expect(readme).toContain(`her ${checkMonthName(cash.paymentMonth)} check drops from ${usd(cash.checkBaseline)} to ${usd(cash.checkAfter)}`);
    expect(readme).toContain(`leaves that ${checkMonthName(shop.paymentMonth)} check at ${usd(shop.checkAfter)}`);
    // The demo video, public on YouTube since Nov 11, 2026; the only video the README links to.
    expect(readme.match(/youtu\.be\/[\w-]+/g)).toEqual(["youtu.be/L4s_d4p7Td8", "youtu.be/L4s_d4p7Td8"]);
  });

  it("the README's housing reach is the engine's, with and without ABLE", () => {
    const h = housingReach();
    const later = h.years[h.years.length - 1];
    expect(readme).toContain(`leaves her ${checkMonthName(later.paymentMonth)} check at ${usd(later.rentWithoutAble)} of ${usd(later.full)}, and through ABLE it stays ${usd(later.rentThroughAble)}`);
    expect(later.rentWithoutAble).toBeLessThan(later.full);
    expect(later.rentThroughAble).toBe(later.full);
  });

  it("docs/results.md states the held-out result as recorded", () => {
    // One summary line for the four sets together, each figure from its results file.
    const lines = resultsDoc.split(/\r?\n/).filter((l) => l.startsWith("**Four held-out sets"));
    expect(lines).toHaveLength(1);
    const [line] = lines;
    const tally = (r: { summary: { engine_matches: number; cases: number } }) => `${r.summary.engine_matches} of ${r.summary.cases}`;
    expect(line).toContain(`**Four held-out sets of SSA examples, each run once on a frozen engine: ${tally(held)}, ${tally(held2)}, ${tally(held3)} and ${tally(held4)}.**`);
    expect(line).toContain(`commit \`${held.engine.commit}\``);
    for (const [r, file] of [[held2, "held-out-2.json"], [held3, "held-out-3.json"], [held4, "held-out-4.json"]] as const) {
      expect(line).toContain(`\`content/eval/${file}\` (git blob \`${r.set.git_blob.slice(0, 7)}\``);
      expect(line).toContain(`frozen at \`${r.engine.commit}\``);
    }
    expect(line).toContain(`${held3.summary.counts_matches} of ${held3.summary.cases} on whether the gift counts`);
    expect(line).toContain(`${held4.summary.counts_matches} of ${held4.summary.cases} on whether the help counts`);
    expect(resultsDoc).toContain(`It matches ${held.summary.engine_matches} of ${held.summary.cases}.`);
    expect(resultsDoc).toContain(`frozen at commit \`${held.engine.commit}\``);
    // Both documents carry the first run's result and say that two expected answers were corrected afterwards, with the reasons in the set.
    const firstRun = `${held.first_run.engine_matches} of ${held.first_run.cases}`;
    expect(line).toContain(`its first run matched ${firstRun}, and two expected answers were then corrected`);
    expect(line).toContain("content/eval/held-out.json");
    expect(resultsDoc).toContain(`corrected after the first run (${firstRun})`);
    expect(heldOutSet.corrections).toHaveLength(2);
    // The second set, written before its run: its result and the blob that ran.
    expect(resultsDoc).toContain(`It matches ${held2.summary.engine_matches} of ${held2.summary.cases}`);
    expect(resultsDoc).toContain(`(\`${held2.set.git_blob.slice(0, 7)}\`)`);
    // The current engine on the second set after the fix, labelled as not a held-out result, from src/lib/held-out.ts.
    const after = heldOut2AfterFix(held2Set.cases as unknown as HeldOutCase[], rules);
    expect(resultsDoc).toContain("**After the fix, not a held-out result.**");
    expect(resultsDoc).toContain(`On the same ${WORDS[after.asWritten.cases]} as written, the current engine matches ${after.asWritten.matches} of ${after.asWritten.cases}.`);
    expect(resultsDoc).toContain(`The other ${WORDS[after.asWritten.misses.length]} turn on a fact the engine had no field for`);
    expect(resultsDoc).toContain(`in the new field, ${after.withFields.matches} of ${after.withFields.cases}`);
  });

  it("docs/results.md states the third set's frozen run and its after-fix line", () => {
    const s = held3.summary;
    expect(resultsDoc).toContain(`run once on the engine frozen at commit \`${held3.engine.commit}\``);
    expect(resultsDoc).toContain(`git blob hash (\`${held3.set.git_blob.slice(0, 7)}\`)`);
    expect(resultsDoc).toContain(`It matches ${s.engine_matches} of ${s.cases} on every value and ${s.counts_matches} of ${s.cases} on whether the gift counts`);
    expect(resultsDoc).toContain(`The ${WORDS[s.misses.length]} that differ showed three rules`);
    const after = heldOut3AfterFix(held3Set.cases as unknown as HeldOutCase[], rules);
    expect(resultsDoc).toContain("**After the fix on the third set, not a held-out result.**");
    expect(resultsDoc).toContain(`On the third set's ${WORDS[after.asWritten.cases]} as written, the current engine matches ${after.asWritten.matches} of ${after.asWritten.cases}`);
    expect(resultsDoc).toContain(`The other ${WORDS[after.asWritten.misses.length]} turn on a fact the engine had no field for when the set was written (the rent is paid by the week`);
    expect(resultsDoc).toContain(`in the new field, ${after.withFields.matches} of ${after.withFields.cases} (\`heldOut3AfterFix()\``);
  });

  it("docs/results.md states the fourth set's frozen run and its after-fix line", () => {
    const s = held4.summary;
    expect(resultsDoc).toContain(`It ran once on the engine frozen at commit \`${held4.engine.commit}\`; the results file records the set's git blob hash (\`${held4.set.git_blob.slice(0, 7)}\`)`);
    expect(resultsDoc).toContain(`It matches ${s.engine_matches} of ${s.cases} on every value and ${s.counts_matches} of ${s.cases} on whether the help counts. The ${WORDS[s.misses.length]} that differ showed two rules`);
    const after = heldOut4AfterFix(held4Set.cases as unknown as HeldOutCase[], rules);
    expect(resultsDoc).toContain("**After the fix on the fourth set, not a held-out result.**");
    expect(resultsDoc).toContain(`On the fourth set's fifteen as written, the current engine matches ${after.asWritten.matches} of ${after.asWritten.cases}`);
    expect(resultsDoc).toContain(`With the facts ${WORDS[Object.keys(HELD_OUT_4_NEW_FIELDS).length]} cases state in the new fields`);
    expect(resultsDoc).toContain(`, ${after.withFields.matches} of ${after.withFields.cases} (\`heldOut4AfterFix()\``);
    // The second class of court cases: the first run as recorded, then the current engine, labelled.
    expect(resultsDoc).toContain(`On its first run, before the engine had a loan field, the engine agreed on ${COURT_NOT_INCOME.score}.`);
    expect(resultsDoc).toContain(`${COURT_NOT_INCOME.now.asWritten.agreed} of ${COURT_NOT_INCOME.now.asWritten.scored} as the cases record the help, and ${COURT_NOT_INCOME.withLoans} with the loan each court found`);
  });

  it("every document names the number of promises the invariant run holds each gift to", () => {
    expect(invariantRun.results).toHaveLength(INVARIANTS.length);
    const word = WORDS[INVARIANTS.length];
    expect(resultsDoc).toContain(`holds each answer to ${word} promises`);
    expect(tests).toContain(`keep all ${word} promises`);
    expect(testing).toContain(`All ${word} promises kept`);
    expect(readFileSync("docs/evidence-index.md", "utf8")).toContain(`keep all ${word} promises`);
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

  it("docs/real-world.md and /about state PayPal's share of the sample year as the engine splits it", () => {
    const y = sampleYearSplit();
    const pct = Math.round((y.paypal.amount / y.total) * 100);
    expect(paypalShareSentence()).toBe(`PayPal carries ${pct} percent of the sample year's dollars today: ${usd(y.paypal.amount)} of ${usd(y.total)}, everything paid to shops and clinics.`);
    expect(realWorld).toContain(paypalShareSentence());
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
