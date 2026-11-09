import first from "../../content/eval/held-out-results.json";
import second from "../../content/eval/held-out-2-results.json";
import third from "../../content/eval/held-out-3-results.json";
import fourth from "../../content/eval/held-out-4-results.json";

/**
 * The held-out sets of SSA worked examples, each run once on a frozen engine, as their results files record them. The
 * one source for the held-out summary: the /evidence card, the headline on /evidence, the README and docs/results.md
 * all state these numbers (tests/held-out-summary.test.ts holds them together).
 */
export const HELD_OUT_SETS = [
  { id: "held-out", file: "content/eval/held-out.json", matches: first.summary.engine_matches, cases: first.summary.cases, counts: first.summary.counts_matches, commit: first.engine.commit },
  { id: "held-out-2", file: "content/eval/held-out-2.json", matches: second.summary.engine_matches, cases: second.summary.cases, counts: second.summary.counts_matches, commit: second.engine.commit },
  { id: "held-out-3", file: "content/eval/held-out-3.json", matches: third.summary.engine_matches, cases: third.summary.cases, counts: third.summary.counts_matches, commit: third.engine.commit },
  { id: "held-out-4", file: "content/eval/held-out-4.json", matches: fourth.summary.engine_matches, cases: fourth.summary.cases, counts: fourth.summary.counts_matches, commit: fourth.engine.commit },
] as const;

const WORDS = ["no", "one", "two", "three", "four", "five", "six"];
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** "4 of 5, 1 of 5, 1 of 5 and 6 of 15": every set's score, in order. */
export const HELD_OUT_SCORES = list(HELD_OUT_SETS.map((s) => `${s.matches} of ${s.cases}`));
/** How many sets, in words. */
export const HELD_OUT_COUNT = WORDS[HELD_OUT_SETS.length] ?? String(HELD_OUT_SETS.length);
/** Examples across every set, and how many of them the engine got right on every value, and on whether the gift counts. */
export const HELD_OUT_TOTAL = {
  cases: HELD_OUT_SETS.reduce((n, s) => n + s.cases, 0),
  matches: HELD_OUT_SETS.reduce((n, s) => n + s.matches, 0),
  counts: HELD_OUT_SETS.reduce((n, s) => n + s.counts, 0),
};
/** The one sentence the /evidence card and the headline use. */
export const HELD_OUT_SENTENCE = `${HELD_OUT_COUNT[0].toUpperCase()}${HELD_OUT_COUNT.slice(1)} sets of SSA's worked examples, each run once on a frozen engine: ${HELD_OUT_SCORES} on every value, and ${HELD_OUT_TOTAL.counts} of ${HELD_OUT_TOTAL.cases} on whether the gift counts.`;
