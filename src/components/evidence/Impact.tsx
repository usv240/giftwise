import Link from "next/link";
import heldOut from "../../../content/eval/held-out-results.json";
import heldOut2 from "../../../content/eval/held-out-2-results.json";
import ssa from "../../../content/eval/ssa-examples-results.json";
import { ERROR_RATES } from "@/lib/error-rates";
import { FAMILY_BASIS, IMPACT, KEPT_LABEL } from "@/lib/impact";

const whole = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * The Evidence page opens with three numbers: what the rules engine says routing would have kept two families in real court cases,
 * how it does on Social Security's own worked examples, and the error that costs money. Each opens its page.
 */
export function Impact() {
  const lowered = ERROR_RATES.lowered;
  return (
    <section className="ji" aria-labelledby="ji-h">
      <h2 id="ji-h" className="ji-h">
        Three numbers first
      </h2>
      <ul className="jr ji-list ji-three">
        <li className="jr-item">
          <Link className="jr-link" href="/evidence/impact#kept">
            <span className="jr-fig tabular">
              {whole(IMPACT.keptMin)} to {whole(IMPACT.keptMax)} a month
            </span>
            <span className="jr-what">{KEPT_LABEL.charAt(0).toUpperCase() + KEPT_LABEL.slice(1)}.</span>
            <span className="jr-base">
              <span className="tabular">{whole(IMPACT.familyTotal)}</span> kept by {IMPACT.familyCases.length === 2 ? "two" : IMPACT.familyCases.length} families over the{" "}
              <span className="tabular">{IMPACT.familyCases.map((c) => c.months).join(" and ")}</span> months their cases cover. {FAMILY_BASIS}
            </span>
          </Link>
        </li>
        <li className="jr-item">
          <Link className="jr-link" href="/evidence/ssa-examples">
            <span className="jr-fig tabular">
              {ssa.summary.engine_matches} of {ssa.summary.cases}
            </span>
            <span className="jr-what">of Social Security&rsquo;s own worked examples match SSA&rsquo;s answer.</span>
            <span className="jr-base">
              Claude with no rulebook: <span className="tabular">{ssa.summary.claude_matches} of {ssa.summary.claude_answered}</span>. New examples the engine
              never saw, run on it frozen: <span className="tabular">{heldOut.summary.engine_matches} of {heldOut.summary.cases}</span>, and{" "}
              <span className="tabular">{heldOut2.summary.engine_matches} of {heldOut2.summary.cases}</span> in a second set written before its run.
            </span>
          </Link>
        </li>
        <li className="jr-item">
          <Link className="jr-link" href="/evidence/rules#errors">
            <span className="jr-fig tabular">
              {lowered.errors} of {lowered.of}
            </span>
            <span className="jr-what">gifts that would lower the check were let through as given.</span>
            <span className="jr-base">Counted over SSA&rsquo;s examples, the court cases and the labeled bills, wherever the right answer is known.</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
