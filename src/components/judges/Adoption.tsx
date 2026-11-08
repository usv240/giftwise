import Link from "next/link";
import { Info } from "@/components/Info";
import { ERROR_RATES } from "@/lib/error-rates";


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

const lowered = ERROR_RATES.lowered;

/** One pilot, sized to SSI's two-month lag, and the two outcomes it reads off records Giftwise already keeps. */
const OUTCOMES = [
  {
    name: "SSI dollars kept",
    what: "The check each gift leaves, with Giftwise.",
    against: "the same gift as cash, priced by the same rules when it is made.",
    where: "the audit ledger: each routed order's entry holds both checks.",
    tech: "audit_events where action = 'paypal.routed_order.created': detail.checkWithRouting against detail.checkIfCash, for orders whose payments rows are captured. The hash chain verifies with npm run verify-ledger.",
  },
  {
    name: "Checks that match the report",
    what: "The check SSA pays each month, against the one the family's report said to expect.",
    against: `${lowered.errors} of ${lowered.of}, the measured rate of gifts let through that the rule counts.`,
    where: "the monthly report, rebuilt from the payments and checkable by its QR code; SSA's amount is on the family's notice.",
    tech: "totals.check from buildReport() in src/lib/report/ssa.ts for each month with gifts; /v/{slug}/{month}/{code} rebuilds it and asks PayPal for each payment.",
  },
] as const;

export function Pilot() {
  return (
    <div className="ad-pilot" data-ui>
      <div className="ad-pilot-top">
        <h3 className="ad-pilot-h">A first pilot</h3>
        <Info id="evidence.pilot" label="" />
      </div>
      <p className="ad-pilot-what">
        One benefits counseling project offers Giftwise to 25 families it already counsels, for 120 days: two months of gifts, and the checks SSA pays for those months two months later.
      </p>
      <dl className="ad-outcomes">
        {OUTCOMES.map((o, i) => (
          <div key={o.name} className="ad-outcome">
            <dt>
              <span className="ad-n tabular" aria-hidden="true">
                {i + 1}
              </span>
              {o.name}
            </dt>
            <dd>{o.what}</dd>
            <dd>
              <span className="ad-use-k">Compared with </span>
              {o.against}
            </dd>
            <dd>
              <span className="ad-use-k">Recorded in </span>
              {o.where}
            </dd>
            <dd className="ad-tech tech-only">{o.tech}</dd>
          </div>
        ))}
      </dl>
      <div className="ad-hold">
        <p>
          <span className="ad-use-k">Why it holds up if a larger tool adds the same AI. </span>
          The model call is the easy part to copy; what decides here is the rules in code, a ledger and reports anyone can check, and error rates measured on Social Security&rsquo;s own examples and federal court
          cases.
        </p>
      </div>
    </div>
  );
}
