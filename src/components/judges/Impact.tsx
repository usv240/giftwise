import { IMPACT } from "@/lib/impact";
import { usd } from "@/lib/rules";

const cents = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** What routing keeps, in dollars, from real federal court cases: first on the Evidence page, before any test count. */
export function Impact() {
  return (
    <section className="ji" aria-labelledby="ji-h">
      <h2 id="ji-h" className="ji-h">
        What it keeps, in real cases
      </h2>
      <ul className="jr ji-list">
        <li className="jr-item">
          <a className="jr-link" href="#field-cases">
            <span className="jr-fig tabular">{usd(IMPACT.keptMonthlyPerPerson)}</span>
            <span className="jr-what">a month kept for each person when the same help is routed the benefit-safe way, in the federal court cases whose facts allow it.</span>
            <span className="jr-base">
              <span className="tabular">{IMPACT.routedCases}</span> of the <span className="tabular">{IMPACT.scoredCases}</span> cases, <span className="tabular">{cents(IMPACT.keptMonthly)}</span> a month in all, at 2026 rates.
            </span>
          </a>
        </li>
        <li className="jr-item">
          <a className="jr-link" href="#field-cases">
            <span className="jr-fig ji-fig-ink tabular">{cents(IMPACT.askedBack)}</span>
            <span className="jr-what">that SSA asked to be paid back in {IMPACT.askedBackCases === 2 ? "two" : IMPACT.askedBackCases} of those cases, for money family members gave or deposited for them.</span>
            <span className="jr-base">The overpayments as each court opinion states them.</span>
          </a>
        </li>
      </ul>
    </section>
  );
}
