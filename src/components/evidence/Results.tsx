import bills from "../../../content/eval-results.json";
import field from "../../../content/eval/field-cases-results.json";
import heldOut from "../../../content/eval/held-out-results.json";
import ssa from "../../../content/eval/ssa-examples-results.json";
import inv from "../../../content/eval/invariants-results.json";
import { IMPACT } from "@/lib/impact";
import { usd } from "@/lib/rules";

/**
 * The results, above the fold: a benchmark from Social Security's own text, a run on real cases Giftwise did not
 * write, what it accepted, and the promises it keeps across random gifts. Every figure is read from the result files the sections below show in full.
 */
export function Results() {
  const ex = ssa.summary;
  const fc = field.summary;
  const routed = fc.dollars.as_shown_in_the_opinions;
  const b = bills.summary;
  const bills_n = b.referee.all_cases;
  return (
    <ul className="jr" aria-label="Results">
      <li className="jr-item">
        <a className="jr-link" href="/evidence/ssa-examples">
          <span className="jr-fig tabular">
            {ex.engine_matches} of {ex.cases}
          </span>
          <span className="jr-what">of Social Security&rsquo;s own worked examples match SSA&rsquo;s answer.</span>
          <span className="jr-base">
            Claude with no rulebook: <span className="tabular">{ex.claude_matches} of {ex.claude_answered}</span>. New examples the engine never saw, run
            on it frozen: <span className="tabular">{heldOut.summary.engine_matches} of {heldOut.summary.cases}</span>.
          </span>
        </a>
      </li>
      <li className="jr-item">
        <a className="jr-link" href="/evidence/court-cases">
          <span className="jr-fig tabular">
            {fc.agreed} of {fc.scored}
          </span>
          <span className="jr-what">real SSI cases from federal courts reach the outcome SSA and the court did.</span>
          <span className="jr-base">
            Help from family was counted against the person in all <span className="tabular">{IMPACT.countedCases}</span>. Routed through Giftwise, the same help would have kept two families{" "}
            <span className="tabular">{usd(Math.round(IMPACT.familyTotal))}</span> over the months their opinions cover, and{" "}
            <span className="tabular">
              {usd(Math.round(IMPACT.keptMin))} to {usd(Math.round(IMPACT.keptMax))}
            </span>{" "}
            a month in <span className="tabular">{routed.cases_where_routing_keeps_money}</span> of them, at 2026 rates.
          </span>
        </a>
      </li>
      <li className="jr-item">
        <a className="jr-link" href="/evidence/rules#evaluation">
          <span className="jr-fig tabular">
            {b.referee.check_kept_whole} of {bills_n}
          </span>
          <span className="jr-what">labeled bills routed so her check stays whole.</span>
          <span className="jr-base">
            Claude with no rulebook: <span className="tabular">{b.baseline.check_kept_whole}</span> of {bills_n}.
          </span>
        </a>
      </li>
      <li className="jr-item">
        <a className="jr-link" href="/evidence/rules#invariants">
          <span className="jr-fig tabular">{inv.gifts.toLocaleString("en-US")}</span>
          <span className="jr-what">random gifts to made-up people, and every one keeps all {inv.results.length} promises.</span>
          <span className="jr-base">
            Every cent placed, and her check exactly as with no gift, in <span className="tabular">{inv.results.find((r) => r.id === "check-whole")!.kept.toLocaleString("en-US")}</span> of{" "}
            <span className="tabular">{inv.gifts.toLocaleString("en-US")}</span>.
          </span>
        </a>
      </li>
    </ul>
  );
}
