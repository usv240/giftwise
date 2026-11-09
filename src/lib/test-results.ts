import results from "../../content/test-results.json";
import invariantRun from "../../content/eval/invariants-results.json";
import { incomeDay } from "./time";

/** Small counts in words, the way the pages and documents write them. */
export const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
export const countWord = (n: number) => COUNT_WORDS[n] ?? String(n);

type Suite = (typeof results.suites)[number];

/**
 * The invariant run as content/eval/invariants-results.json records it: how many promises each gift is held to, how
 * many gifts kept every one, and the day it ran in Pacific time. The one source for those numbers on every page.
 */
export const INVARIANT_RUN = {
  promises: invariantRun.results.length,
  promisesWord: countWord(invariantRun.results.length),
  gifts: invariantRun.gifts,
  keptAll: invariantRun.gifts - Math.max(0, ...invariantRun.results.map((r) => r.broken)),
  ranAt: incomeDay(invariantRun.ran_at),
};

/**
 * Each suite's row as the pages show it. A suite's "what" names the promise count as {promises}, filled here from the
 * invariant run; the invariant suite's own counts and date come from its results file, so the row, /evidence and
 * /evidence/rules always state the same run.
 */
export function suiteRows(): Suite[] {
  return results.suites.map((s) => {
    const what = s.what.replace(/\{promises\}/g, INVARIANT_RUN.promisesWord);
    return s.id === "invariants" ? { ...s, what, passed: INVARIANT_RUN.keptAll, total: INVARIANT_RUN.gifts, ranAt: INVARIANT_RUN.ranAt } : { ...s, what };
  });
}

/** The latest day any suite ran, from the rows above. */
export const latestRun = () => suiteRows().map((s) => s.ranAt).sort().at(-1) ?? results.ranAt;
