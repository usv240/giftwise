import Link from "next/link";
import fieldResults from "../../../content/eval/field-cases-results.json";

const routed = fieldResults.summary.dollars.as_shown_in_the_opinions;
const perPerson = routed.kept_per_month_2026 / routed.cases_where_routing_keeps_money;
const usd = (n: number, cents = false) => `$${n.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;

/** Three groups that already help people on SSI with money, each with its published size and how it would run Giftwise. */
const ROUTES = [
  {
    who: "Benefits counselors",
    count: "75 projects",
    size: (
      <>
        in Social Security&rsquo;s current round of Work Incentives Planning and Assistance, the free benefits counseling it funds nationwide, with $20 million in funding (
        <a className="text-link" href="https://www.highergov.com/grant-opportunity/ssa-work-incentives-planning-and-assistance-program-wipa-331605/" target="_blank" rel="noreferrer">
          WIPA-WIP-21-001
        </a>
        ;{" "}
        <a className="text-link" href="https://choosework.ssa.gov/library/fact-sheet-benefits-counseling-and-the-path-to-employment" target="_blank" rel="noreferrer">
          SSA
        </a>
        ).
      </>
    ),
    use: "A counselor makes the gift page with the family in one visit and hands over the organizer link. Each month the family has the report to file by the 10th, with the rule behind every gift, in Easy Read and in Spanish.",
    link: ["/manage/maya-sample-organizer", "The organizer's side"],
  },
  {
    who: "State ABLE programs",
    count: "46 states and DC",
    size: (
      <>
        run an ABLE program, 31 plans accept people from any state, and more than 246,000 accounts are open (
        <a className="text-link" href="https://www.ablenrc.org/choose-plan/" target="_blank" rel="noreferrer">
          ABLE National Resource Center
        </a>
        ,{" "}
        <a className="text-link" href="https://www.ablenrc.org/achievable-newsletter-june-2026-issue/" target="_blank" rel="noreferrer">
          June 2026
        </a>
        ).
      </>
    ),
    use: "A plan links its gift page to Giftwise. The ABLE share of each gift goes back to the plan's own gift link, and a need better paid to a shop, like a wheelchair repair, is paid to the shop through PayPal in the same checkout.",
    link: ["/about#real", "How ABLE gifts work for real"],
  },
  {
    who: "Payee organizations",
    count: "1 in 10",
    size: (
      <>
        of the 7.7 million people with a representative payee are served by an organization: a nonprofit, an agency or a social services office (FY2024,{" "}
        <a className="text-link" href="https://www.congress.gov/crs_external_products/IF/PDF/IF13018/IF13018.2.pdf" target="_blank" rel="noreferrer">
          Congressional Research Service
        </a>
        ).
      </>
    ),
    use: "An organization pays shops and ABLE accounts for many people in one PayPal Payouts batch, confirmed in PayPal's Transaction Search, with each person's ledger and monthly report ready when SSA asks for its yearly accounting.",
    link: ["/organizations", "A fund pays many families"],
  },
] as const;

/** Shared with /organizations, which makes the payee organizations' case from the same card. */
export const ADOPTION_ROUTES = ROUTES;

export function Adoption() {
  return (
    <>
      <div className="ad-value" data-ui>
        <p className="ad-value-n tabular">
          {usd(Math.round(perPerson))}
          <span className="ad-value-unit"> a month, for each person</span>
        </p>
        <p className="ad-value-what">
          In the {routed.cases_where_routing_keeps_money} federal court cases where the facts allow a benefit-safe route, the same help routed through Giftwise keeps {usd(routed.kept_per_month_2026, true)} a month at 2026 rates: about{" "}
          {usd(Math.round(perPerson))} for each person, or {usd(Math.round(perPerson * 12 / 10) * 10)} a year.{" "}
          <a className="text-link" href="#field-cases">
            The cases
          </a>
        </p>
      </div>
      <ol className="ad-routes">
        {ROUTES.map((r, i) => (
          <li key={r.who} className="ad-route" data-ui>
            <p className="ad-who">
              <span className="ad-n tabular" aria-hidden="true">
                {i + 1}
              </span>
              {r.who}
            </p>
            <p className="ad-size">
              <strong className="ad-count">{r.count}</strong> {r.size}
            </p>
            <p className="ad-use">
              <span className="ad-use-k">With Giftwise. </span>
              {r.use}
            </p>
            <Link className="text-link ad-link" href={r.link[0]}>
              {r.link[1]}
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
