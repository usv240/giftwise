import bills from "../../../content/eval-results.json";
import field from "../../../content/eval/field-cases-results.json";
import ssa from "../../../content/eval/ssa-examples-results.json";
import inv from "../../../content/eval/invariants-results.json";
import { usd } from "@/lib/rules";

/**
 * The results, above the fold: a benchmark from Social Security's own text, a run on real cases Giftwise did not
 * write, what it accepted, and the promises it keeps across random gifts. Every figure is read from the result files the sections below show in full.
 */
export function Results() {
  const ex = ssa.summary;
  const fc = field.summary;
  const b = bills.summary;
  const bills_n = b.referee.all_cases;
  return (
    <ul className="jr" aria-label="Results">
      <li className="jr-item">
        <a className="jr-link" href="#ssa-examples">
          <span className="jr-fig tabular">
            {ex.engine_matches} of {ex.cases}
          </span>
          <span className="jr-what">of Social Security&rsquo;s own worked examples match SSA&rsquo;s answer.</span>
          <span className="jr-base">
            Claude with no rulebook: <span className="tabular">{ex.claude_matches} of {ex.claude_answered}</span>.
          </span>
        </a>
      </li>
      <li className="jr-item">
        <a className="jr-link" href="#field-cases">
          <span className="jr-fig tabular">
            {fc.agreed} of {fc.scored}
          </span>
          <span className="jr-what">real SSI cases from federal courts reach the outcome SSA and the court did.</span>
          <span className="jr-base">
            Routed through Giftwise, the same help keeps <span className="tabular">{usd(fc.dollars.as_shown_in_the_opinions.kept_per_month_2026)}</span> a month.
          </span>
        </a>
      </li>
      <li className="jr-item">
        <a className="jr-link" href="#evaluation">
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
        <a className="jr-link" href="#invariants">
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
