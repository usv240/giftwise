import type { Metadata } from "next";
import Link from "next/link";
import facts from "../../../content/facts.json";
import results from "../../../content/test-results.json";
import { Info } from "@/components/Info";
import { CaseRunner } from "@/components/judges/CaseRunner";
import { EvalResults } from "@/components/judges/EvalResults";
import "../pages.css";
import "../developers/dev.css";
import "./judges.css";

export const metadata: Metadata = { title: "For judges", description: "The five-minute path through Giftwise, every failure case run live, and the test results." };

const PATH = [
  { href: "/", label: "Home", look: "The problem in one number: $1,000 given as cash leaves Maya a $74 check two months later. Paying the shop for what she needs keeps all $994." },
  { href: "/g/maya", label: "Maya's gift page", look: "Type $1,500 in Give any amount. Giftwise splits it across her needs and her ABLE account, and one PayPal checkout pays five recipients directly." },
  { href: "/g/maya", label: "Pay in the sandbox", look: "Use the sandbox buyer login in TESTING.md. When it completes, open the receipt." },
  { href: "/try", label: "Try it", look: "Read the sample electric bill with Claude, or check any gift. Switch View to Technical to see rule ids and API details." },
  { href: "/agents", label: "An AI agent asks first", look: "A Claude assistant uses the Giftwise MCP server to check a gift, plan it, and start a PayPal checkout the giver approves. Run it live." },
  { href: "/organizations", label: "A fund pays many families", look: "Send a grant as one PayPal Payouts batch. Each item goes straight to a shop or ABLE account, and Transaction Search confirms it in PayPal's report." },
  { href: "/dashboard", label: "Maya's year", look: "An AG Studio dashboard of every gift and her check each month, compared with cash. Press a giver: the Giftwise widget reruns the rules engine on just their gifts." },
  { href: "#failure-cases", label: "Failure cases", look: "Run all eight checks below. Seven create real sandbox orders and show what PayPal answered; one shows the referee catching a wrong AI answer." },
  { href: "/status", label: "Status and stack", look: "Every service and sponsor tool, and whether it is live or using its fallback right now." },
];

const CRITERIA = [
  { name: "Technological implementation", where: "One PayPal order paying several payees, server-side capture with idempotency, approval links for agents, Payouts for funds with Transaction Search reconciliation, signature-verified webhooks, sandbox negative testing, and Claude structured outputs checked by a deterministic rules engine.", links: [["/status", "Status"], ["/stack", "Stack"]] },
  {
    name: "Design",
    where: "Light and dark, phone and desktop, an Info button on everything, plain and technical views, accessible to WCAG 2.2 AA. The AG Studio dashboard takes its colors and fonts from the same tokens.",
    links: [
      ["/g/maya", "Gift page"],
      ["/try", "Try it"],
      ["/dashboard", "Maya's year"],
    ],
  },
  { name: "Potential impact", where: `About ${facts.audience.ssi_recipients.value} people receive SSI (September 2026). Gifts given as cash can lower the check. Every answer cites the regulation or SSA's operating manual.`, links: [["/learn", "The rules, explained"]] },
  {
    name: "Innovation",
    where:
      "The money is routed by the rules before PayPal moves it, and anyone can check the result on a public receipt. AI assistants can ask Giftwise first over MCP, and two reviewers with different rulebooks must quote their source word for word.",
    links: [
      ["/g/maya", "Give any amount"],
      ["/agents", "For AI agents"],
      ["/try/presets/electric-bill", "The two reviewers"],
    ],
  },
  { name: "Presentation", where: "This page, the demo video, and a sample household you can reset to the same starting point at any time.", links: [["/about", "About"]] },
] as const;

export default function JudgesPage() {
  return (
    <div className="page frame judges">
      <header className="page-head">
        <div className="title-row">
          <h1 className="page-title">For judges</h1>
          <Info id="page.judges" />
        </div>
        <p className="lede">The five-minute path through Giftwise, every failure case run live against PayPal, and the test results.</p>
      </header>

      <section className="page-section" aria-labelledby="path-h">
        <h2 id="path-h">The five-minute path</h2>
        <ol className="jp-path">
          {PATH.map((p, i) => (
            <li key={p.label} className="jp-step" data-ui>
              <span className="jp-n tabular" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <Link className="jp-link" href={p.href}>
                  {p.label}
                </Link>
                <p>{p.look}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="failure-cases" className="page-section" aria-labelledby="cases-h">
        <div className="title-row">
          <h2 id="cases-h">Failure cases, run live</h2>
          <Info id="judges.cases" label="" />
        </div>
        <p className="page-prose jp-intro">Payments fail in ordinary ways: a declined card, a double click, a browser that sends the wrong amount. Each check below runs the real code against the PayPal sandbox.</p>
        <CaseRunner />
      </section>

      <section id="evaluation" className="page-section" aria-labelledby="eval-h">
        <div className="title-row">
          <h2 id="eval-h">The two reviewers, measured</h2>
          <Info id="judges.eval" label="" />
        </div>
        <EvalResults />
      </section>

      <section className="page-section" aria-labelledby="crit-h">
        <h2 id="crit-h">Where each criterion shows</h2>
        <dl className="jp-criteria">
          {CRITERIA.map((c) => (
            <div key={c.name} className="jp-criterion">
              <dt>{c.name}</dt>
              <dd>
                <p>{c.where}</p>
                <p className="jp-links">
                  {c.links.map(([href, label]) => (
                    <Link key={href + label} className="text-link" href={href}>
                      {label}
                    </Link>
                  ))}
                </p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="page-section" aria-labelledby="tests-h">
        <div className="title-row">
          <h2 id="tests-h">Test results</h2>
          <Info id="judges.tests" label="" />
        </div>
        <p className="page-prose jp-intro">
          Last run {new Date(`${results.ranAt}T12:00:00Z`).toLocaleDateString("en-US", { dateStyle: "long" })}. {results.build}.
        </p>
        <ul className="jp-tests">
          {results.suites.map((s) => (
            <li key={s.id} className="jp-test" data-ui>
              <p className="jp-test-score tabular">
                {s.passed}/{s.total}
              </p>
              <div>
                <p className="jp-test-name">{s.name}</p>
                <p className="jp-test-what">{s.what}</p>
                <p className="jp-test-cmd tabular">{s.command}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
