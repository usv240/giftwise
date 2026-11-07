import ssaCases from "../../content/eval/ssa-examples.json";
import ssaRun from "../../content/eval/ssa-examples-results.json";
import fieldRun from "../../content/eval/field-cases-results.json";
import billRun from "../../content/eval-results.json";
import invariantRun from "../../content/eval/invariants-results.json";

/**
 * The two errors that cost money, counted over every recorded case whose right answer is known:
 *   lowered: Giftwise let a gift through as given, and the rule says that gift counts against the check;
 *   held:    the rule treats the gift as fine as given, and Giftwise rerouted or held it.
 * "As given" is the gift as the case describes it (for a bill, paid straight to the company). Read from the recorded
 * runs only, with no model call: SSA's worked examples, the federal court cases and the labeled bills. The 7 contested
 * bills have no single right answer, so they count in neither rate.
 */

export type Tally = { errors: number; of: number; ids: string[] };
export type ErrorSource = { id: "ssa" | "court" | "bills"; label: string; file: string; lowered: Tally; held: Tally };

const tally = (): Tally => ({ errors: 0, of: 0, ids: [] });
function add(t: Tally, id: string, error: boolean) {
  t.of += 1;
  if (error) {
    t.errors += 1;
    t.ids.push(id);
  }
}

/** Score one case: `counts` is the right answer for the gift as given, `letThrough` is whether Giftwise kept it as given. */
function score(src: Omit<ErrorSource, "lowered" | "held">, rows: { id: string; counts: boolean; letThrough: boolean }[]): ErrorSource {
  const lowered = tally();
  const held = tally();
  for (const r of rows) {
    if (r.counts) add(lowered, r.id, r.letThrough);
    else add(held, r.id, !r.letThrough);
  }
  return { ...src, lowered, held };
}

const expected = new Map(ssaCases.cases.map((c) => [c.id, c.expected.counts]));

/** SSA's answer for each worked example, against the engine's answer for the gift as entered. */
const ssa = score(
  { id: "ssa", label: "Social Security's examples", file: "content/eval/ssa-examples.json, content/eval/ssa-examples-results.json" },
  ssaRun.cases.map((r) => ({ id: r.id, counts: expected.get(r.id)!, letThrough: !r.engine.counts })),
);

/** What SSA and the court held, against the engine's answer for the help as it was given. */
const court = score(
  { id: "court", label: "Federal court cases", file: "content/eval/field-cases-results.json" },
  fieldRun.cases.map((r) => ({ id: r.id, counts: r.determination.counts, letThrough: !r.engine.counts })),
);

/** `safe` is the recorded run's own test: her check equals the check with no gift at all (scripts/run-eval.ts). */
type BillOutcome = { decision: string; route: string | null; safe: boolean };
type BillCase = { id: string; set: string; truth: string; outcome: Record<"baseline" | "referee", BillOutcome> };
const clearBills = (billRun.cases as BillCase[]).filter((c) => c.truth !== "contested");

/** A housing bill paid straight to the company counts; any other bill paid that way does not. Giftwise keeps a bill as given when it pays the company. */
const billRows = (who: "baseline" | "referee") => clearBills.map((c) => ({ id: c.id, counts: c.truth === "shelter", letThrough: c.outcome[who].route === "vendor" }));
const billSource = { id: "bills" as const, label: "Labeled bills", file: "content/eval-results.json" };
const bills = score(billSource, billRows("referee"));
/** The same bills read by Claude with no rulebook, for comparison. */
const billsWithoutRulebook = score(billSource, billRows("baseline"));

const sum = (key: "lowered" | "held", sources: ErrorSource[]): Tally => ({
  errors: sources.reduce((n, s) => n + s[key].errors, 0),
  of: sources.reduce((n, s) => n + s[key].of, 0),
  ids: sources.flatMap((s) => s[key].ids),
});

const SOURCES = [ssa, court, bills];
const heldBills = (billRun.cases as BillCase[]).filter((c) => bills.held.ids.includes(c.id));
const checkWhole = invariantRun.results.find((r) => r.id === "check-whole")!;

export const ERROR_RATES = {
  sources: SOURCES,
  lowered: sum("lowered", SOURCES),
  held: sum("held", SOURCES),
  /** Where each held gift went, and whether her check stayed exactly as with no gift in every one. */
  heldRoutes: [...new Set(heldBills.map((c) => c.outcome.referee.route))],
  heldCheckWhole: heldBills.every((c) => c.outcome.referee.safe),
  /** Whether every held bill is one the two reviewers left unsettled, and one from the harder set of bills. */
  heldUnsettled: heldBills.every((c) => c.outcome.referee.decision === "unsure"),
  heldHardSet: heldBills.every((c) => c.set === "hard"),
  billsWithoutRulebook: { lowered: billsWithoutRulebook.lowered, held: billsWithoutRulebook.held },
  contestedBills: (billRun.cases as BillCase[]).length - clearBills.length,
  /** Inside the engine: the routes it chose for random gifts that lowered her check below the no-gift check. */
  randomGifts: { gifts: invariantRun.gifts, lowered: checkWhole.broken },
};
