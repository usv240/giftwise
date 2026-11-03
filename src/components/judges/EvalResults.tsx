import results from "../../../content/eval-results.json";
import { stressTest } from "@/lib/review/stress";

type Row = {
  id: string;
  description: string;
  truth: "shelter" | "not_shelter" | "contested";
  basis: string;
  regs: { answer: string; cite: string | null; quote_checked: boolean };
  poms: { answer: string; cite: string | null; quote_checked: boolean };
  outcome: Record<"regs" | "poms" | "referee", { decision: string; route: string | null; check: number | null; safe: boolean }>;
};
type Summary = { clear_cases: number; correct: number; wrong: number; abstained: number; all_cases: number; check_kept_whole: number };
type Results = { ran_at: string; model: string; amount: number; quotes_checked: number; quotes_total: number; summary: Record<"regs" | "poms" | "referee", Summary>; cases: Row[] };

const R = results as unknown as Results;
const SETUP = [
  ["regs", "Regulations reviewer alone"],
  ["poms", "Manual reviewer alone"],
  ["referee", "Both reviewers and the referee"],
] as const;
const WORD: Record<string, string> = { shelter: "Housing", not_shelter: "Not housing", unclear: "Not settled", unsure: "Not settled", contested: "Rulebooks differ" };
const ROUTE: Record<string, string> = { vendor: "Pay the business", able: "ABLE account" };

/** If one reviewer is wrong: the same 20 bills with one reviewer's recorded answer flipped. Computed from the recorded run, no AI call. */
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

/** The measured evaluation of the two reviewers on 20 labeled bills. Every number comes from content/eval-results.json. */
export function EvalResults() {
  const date = new Date(R.ran_at).toLocaleDateString("en-US", { dateStyle: "medium" });
  return (
    <div className="ev">
      <p className="page-prose">
        {R.cases.length} bills paid by someone else, each labeled from the rule text: {R.summary.referee.clear_cases} where the rules are clear, and{" "}
        {R.cases.length - R.summary.referee.clear_cases} where the two rulebooks differ or one bill mixes both kinds. Run {date} with {R.model}. {R.quotes_checked} of {R.quotes_total} quotes
        were found word for word.
      </p>
      <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="Evaluation summary">
        <table className="doc-table">
          <thead>
            <tr>
              <th scope="col">Setup</th>
              <th scope="col">Right, clear cases</th>
              <th scope="col">Wrong</th>
              <th scope="col">Left unsettled</th>
              <th scope="col">Check kept whole, all cases</th>
            </tr>
          </thead>
          <tbody>
            {SETUP.map(([k, label]) => {
              const s = R.summary[k];
              return (
                <tr key={k}>
                  <td>{label}</td>
                  <td className="tabular">
                    {s.correct} of {s.clear_cases}
                  </td>
                  <td className="tabular">{s.wrong}</td>
                  <td className="tabular">{s.abstained}</td>
                  <td className="tabular">
                    {s.check_kept_whole} of {s.all_cases}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="page-prose">On this set the rules are clear, and one reviewer alone did as well as two. The second reviewer and the referee are there for the day one of them is wrong, so we measured that too.</p>
      <StressTable />
      <details className="ev-cases">
        <summary>Every bill and both answers</summary>
        <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="Every bill in the evaluation">
          <table className="doc-table">
            <thead>
              <tr>
                <th scope="col">Bill</th>
                <th scope="col">Label</th>
                <th scope="col">Regulations</th>
                <th scope="col">Manual</th>
                <th scope="col">Giftwise</th>
              </tr>
            </thead>
            <tbody>
              {R.cases.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.description}
                    <span className="ev-basis">{c.basis}</span>
                  </td>
                  <td>{WORD[c.truth]}</td>
                  <td>
                    {WORD[c.regs.answer] ?? c.regs.answer}
                    {!c.regs.quote_checked && " (quote set aside)"}
                  </td>
                  <td>
                    {WORD[c.poms.answer] ?? c.poms.answer}
                    {!c.poms.quote_checked && " (quote set aside)"}
                  </td>
                  <td>
                    {c.outcome.referee.route ? ROUTE[c.outcome.referee.route] : "No route"}
                    {c.outcome.referee.safe ? ", check whole" : ", check lower"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
