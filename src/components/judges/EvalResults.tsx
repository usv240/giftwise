import results from "../../../content/eval-results.json";
import { stressTest } from "@/lib/review/stress";
import { modelName } from "@/lib/ai/model-name";

type Setup = "baseline" | "regs" | "poms" | "referee";
type SetId = "first" | "hard";
type Vote = { answer: string; cite: string | null; quote_checked: boolean };
type Row = {
  id: string;
  set?: SetId;
  description: string;
  truth: "shelter" | "not_shelter" | "contested";
  basis: string;
  baseline: { answer: string; route: string } | null;
  regs: Vote;
  poms: Vote;
  outcome: Record<Setup, { decision: string; route: string | null; check: number | null; safe: boolean }>;
};
type Summary = { clear_cases: number; correct: number; wrong: number; abstained: number; all_cases: number; check_kept_whole: number; wrong_routes_accepted: number };
type Control = {
  bills: number;
  clear_bills: number;
  contested_bills: number;
  wrong_routes_accepted: Record<Setup, number>;
  wrong_routes_on_clear_bills: Record<Setup, number>;
  wrong_routes_on_contested_bills: Record<Setup, number>;
  disagreements_total: number;
  disagreements_sent_to_safe_route: number;
  disagreement_kinds: { opposite_answers: number; one_reviewer_unsettled: number; both_reviewers_unsettled: number; quote_set_aside: number };
  quotes_checked: number;
  quotes_total: number;
};
type Results = {
  ran_at: string;
  model: string;
  amount: number;
  quotes_checked: number;
  quotes_total: number;
  summary: Record<Setup, Summary>;
  sets: Record<SetId, { label: string; bills: number; summary: Record<Setup, Summary>; negative_control: Control }>;
  negative_control: Control;
  cases: Row[];
};

const R = results as unknown as Results;
const NC = R.negative_control;
const SETUP: readonly (readonly [Setup, string])[] = [
  ["baseline", "Claude alone, no rulebook"],
  ["regs", "Regulations reviewer alone"],
  ["poms", "Manual reviewer alone"],
  ["referee", "Both reviewers and the referee"],
];
/** Column headings, short enough that all four setups fit at phone width. */
const SHORT: Record<Setup, string> = { baseline: "Claude, no rulebook", regs: "Regulations alone", poms: "Manual alone", referee: "Both reviewers, referee" };
const NAME: Record<Setup, string> = { baseline: "Claude with no rulebook", regs: "the regulations reviewer alone", poms: "the manual reviewer alone", referee: "the referee" };
const WORD: Record<string, string> = { shelter: "Housing", not_shelter: "Not housing", unclear: "Not settled", unsure: "Not settled", contested: "Contested" };
const ROUTE: Record<string, string> = { vendor: "Pay the business", able: "ABLE account" };
const SETS: readonly (readonly [SetId, string])[] = [
  ["first", "First 20 bills"],
  ["hard", "Harder bills, near the line"],
];

const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

/** The measured result in words, built from the numbers so it never drifts from the run. */
function headline() {
  const w = NC.wrong_routes_accepted;
  const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
  const where = (k: Setup) => {
    const clear = NC.wrong_routes_on_clear_bills[k];
    const contested = NC.wrong_routes_on_contested_bills[k];
    if (clear && contested) return ` (${clear} where the rules are clear, ${contested} on contested bills)`;
    if (clear) return w[k] === 1 ? ", where the rules are clear" : ", all where the rules are clear";
    return w[k] === 1 ? ", on a contested bill" : ", all on contested bills";
  };
  const some = SETUP.filter(([k]) => w[k] > 0).map(([k]) => `${cap(NAME[k])} accepted ${n(w[k], "route", "routes")} that would lower her check${where(k)}.`);
  const none = SETUP.filter(([k]) => w[k] === 0).map(([k]) => NAME[k]);
  if (none.length) some.push(`${cap(none.length > 1 ? `${none.slice(0, -1).join(", ")} and ${none[none.length - 1]}` : none[0])} accepted none.`);
  return some.join(" ");
}

const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0]);

/** What the referee does on this run, in words built from the numbers so it never drifts from the run. */
function gain() {
  const w = NC.wrong_routes_accepted;
  const ref = w.referee;
  const better = SETUP.filter(([k]) => k !== "referee" && w[k] > ref).map(([k]) => NAME[k]);
  const same = SETUP.filter(([k]) => k !== "referee" && w[k] === ref).map(([k]) => NAME[k]);
  const s = R.summary.referee;
  const parts: string[] = [];
  if (better.length) parts.push(`The referee accepted fewer wrong routes than ${list(better)}${same.length ? `, as few as ${list(same)},` : ""} and kept her check whole on ${s.check_kept_whole} of ${s.all_cases} bills.`);
  else if (same.length) parts.push(`The referee accepted as few wrong routes as ${list(same)} and kept her check whole on ${s.check_kept_whole} of ${s.all_cases} bills.`);
  parts.push(`It settled ${s.correct} of ${s.clear_cases} clear bills on a shared, checked reading; for the other ${s.abstained} it chose the route that keeps her check whole under either reading.`);
  return parts.join(" ");
}

/** If one reviewer is wrong: the same bills with one reviewer's recorded answer flipped. Computed from the recorded run, no AI call. */
function StressTable() {
  const t = stressTest();
  return (
    <div className="ev-stress">
      <h3 className="ev-stress-h">When one reviewer is wrong</h3>
      <p className="muted">
        For each bill, one reviewer&rsquo;s recorded answer is flipped, quoted from its own rulebook or with a quote that is not in it. How often does her check stay whole?
      </p>
      <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="Check kept whole when one reviewer is wrong">
        <table className="doc-table">
          <thead>
            <tr>
              <th scope="col">Setup</th>
              <th scope="col">Check kept whole</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Trust the wrong reviewer alone</td>
              <td className="tabular">
                {t.aloneWhole} of {t.bills}
              </td>
            </tr>
            <tr>
              <td>Both reviewers and the referee, the wrong one quoting its rulebook</td>
              <td className="tabular">
                {t.refereeRealQuoteWhole} of {t.bills}
              </td>
            </tr>
            <tr>
              <td>Both reviewers and the referee, the wrong one inventing a quote</td>
              <td className="tabular">
                {t.refereeInventedQuoteWhole} of {t.bills}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="muted tech-only">src/lib/review/stress.ts: reviews rebuilt from content/eval-results.json, each answer scored with referee() and routeForDecision() against the bill&rsquo;s label.</p>
    </div>
  );
}

function Answer({ v }: { v: Vote }) {
  return (
    <>
      {WORD[v.answer] ?? v.answer}
      {!v.quote_checked && " (quote set aside)"}
    </>
  );
}

/** The measured evaluation: Claude with no rulebook, each reviewer alone, and the referee, on two sets of labeled bills. Every number comes from content/eval-results.json. */
export function EvalResults() {
  const date = new Date(R.ran_at).toLocaleDateString("en-US", { dateStyle: "medium" });
  const s = R.summary;
  const k = NC.disagreement_kinds;
  return (
    <div className="ev">
      <p className="page-prose">
        {R.cases.length} bills paid by someone else, in two sets: the first {R.sets.first.bills}, and {R.sets.hard.bills} harder bills near the line between housing and everything else, such as lot rent
        for a mobile home, a second mortgage, condo fees and a refundable utility deposit. Each is labeled from the rule text with the passage cited: {NC.clear_bills} where the rules are clear, and{" "}
        {NC.contested_bills} where the two rulebooks point different ways or neither settles it. Run {date} with {modelName(R.model)}. {R.quotes_checked} of {R.quotes_total} quotes were found word for word.
      </p>
      <p className="page-prose">
        The baseline is the obvious alternative: Claude alone, given only the bill, decides whether it is housing and picks the route, with no rulebook, no quotes and no referee. A wrong route is one that
        would lower her check under the true reading; for a contested bill, under either reading.
      </p>
      <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="Evaluation summary, all bills">
        <table className="doc-table">
          <thead>
            <tr>
              <th scope="col">All {R.cases.length} bills</th>
              {SETUP.map(([key, label]) => (
                <th key={key} scope="col" title={label}>
                  {SHORT[key]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Wrong routes accepted</th>
              {SETUP.map(([key]) => (
                <td key={key} className="tabular">
                  {NC.wrong_routes_accepted[key]} of {NC.bills}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Right, clear bills</th>
              {SETUP.map(([key]) => (
                <td key={key} className="tabular">
                  {s[key].correct} of {s[key].clear_cases}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Wrong, clear bills</th>
              {SETUP.map(([key]) => (
                <td key={key} className="tabular">
                  {s[key].wrong}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Sent to the either-reading route</th>
              {SETUP.map(([key]) => (
                <td key={key} className="tabular">
                  {s[key].abstained}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="page-prose">{headline()}</p>
      <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="Wrong routes accepted, by set">
        <table className="doc-table">
          <thead>
            <tr>
              <th scope="col">Wrong routes accepted</th>
              {SETUP.map(([key, label]) => (
                <th key={key} scope="col" title={label}>
                  {SHORT[key]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SETS.map(([id, label]) => (
              <tr key={id}>
                <th scope="row">
                  {label} ({R.sets[id].bills})
                </th>
                {SETUP.map(([key]) => (
                  <td key={key} className="tabular">
                    {R.sets[id].negative_control.wrong_routes_accepted[key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="page-prose">
        The two checked readings differed on {n(NC.disagreements_total, "bill", "bills")}: {k.opposite_answers} where the reviewers gave opposite answers, {k.one_reviewer_unsettled} where one
        rulebook did not settle it, {k.both_reviewers_unsettled} where neither did
        {k.quote_set_aside ? `, and ${k.quote_set_aside} where a quote was set aside` : ""}. It sent {NC.disagreements_sent_to_safe_route} of {NC.disagreements_total} to a route that keeps her check whole
        under either reading. {gain()}
      </p>
      <StressTable />
      <details className="ev-cases">
        <summary>Every bill and every answer</summary>
        <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="Every bill in the evaluation">
          <table className="doc-table">
            <thead>
              <tr>
                <th scope="col">Bill</th>
                <th scope="col">Label</th>
                <th scope="col">No rulebook</th>
                <th scope="col">Regulations</th>
                <th scope="col">Manual</th>
                <th scope="col">Giftwise</th>
              </tr>
            </thead>
            {SETS.map(([id, label]) => (
              <tbody key={id}>
                <tr>
                  <th scope="rowgroup" colSpan={6}>
                    {label}
                  </th>
                </tr>
                {R.cases
                  .filter((c) => (c.set ?? "first") === id)
                  .map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.description}
                        <span className="ev-basis">{c.basis}</span>
                      </td>
                      <td>{WORD[c.truth]}</td>
                      <td>
                        {c.baseline ? `${WORD[c.baseline.answer] ?? c.baseline.answer}, ${ROUTE[c.baseline.route] ?? c.baseline.route}` : "No answer"}
                        {!c.outcome.baseline.safe && ", check lower"}
                      </td>
                      <td>
                        <Answer v={c.regs} />
                      </td>
                      <td>
                        <Answer v={c.poms} />
                      </td>
                      <td>
                        {c.outcome.referee.route ? ROUTE[c.outcome.referee.route] : "No route"}
                        {c.outcome.referee.safe ? ", check whole" : ", check lower"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            ))}
          </table>
        </div>
      </details>
      <p className="muted tech-only">scripts/run-eval.ts over content/eval/bills.json and content/eval/bills-hard.json; add --rescore to re-score the recorded answers with no AI calls.</p>
    </div>
  );
}
