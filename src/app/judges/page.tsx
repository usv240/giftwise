import type { Metadata } from "next";
import Link from "next/link";
import facts from "../../../content/facts.json";
import results from "../../../content/test-results.json";
import { Info } from "@/components/Info";
import { CaseRunner } from "@/components/judges/CaseRunner";
import { EvalResults } from "@/components/judges/EvalResults";
import { NightlyChecks } from "@/components/judges/NightlyChecks";
import { SsaExamples } from "@/components/judges/SsaExamples";
import { SandboxLogin } from "@/components/SandboxLogin";
import { Suspense } from "react";
import "../pages.css";
import "../developers/dev.css";
import "./judges.css";

export const metadata: Metadata = { title: "For judges", description: "The five-minute path through Giftwise, every failure case run live, and the test results." };

/** The five-minute path: five steps, about a minute each, in the order the story runs. */
const PATH = [
  { href: "/", label: "The problem in one number", time: "20 s", look: "In the Gift Checker, $1,000 sent as cash leaves Maya a $74 check two months later. Press Pay the shop: she keeps all $994." },
  { href: "/g/maya", label: "Give, and pay in the sandbox", time: "90 s", look: "Type $1,500 in Give any amount. The rules split it across her needs and her ABLE account, and one PayPal checkout pays all five recipients. Log in with the sandbox buyer below, then open the receipt." },
  { href: "/g/maya/report?month=2026-10", label: "Her report to Social Security", time: "40 s", look: "SSI asks for changes in income by the 10th. October's report says nothing counts, with the rule behind every gift. Press As cash: the same gifts would have counted $538 and cut her check to $456." },
  { href: "/agents", label: "An AI assistant asks first", time: "40 s", look: "A Claude assistant with no SSI knowledge calls the Giftwise MCP server, talks June out of sending cash, starts a checkout only she can approve, and reads the order back from PayPal." },
  { href: "/g/maya/calendar?month=2026-10", label: "Her benefit calendar", time: "40 s", look: "Press As cash and drag Aunt June's $150 from October 28 to November 2. A different check drops: SSI counts income by calendar month." },
];

/** Everything else, for a judge with more time. */
const MORE = [
  { href: "/try/presets/electric-bill", label: "Claude reads a bill; two reviewers check it", look: "Two Claude reviewers with different rulebooks must quote them word for word. Press What if a reviewer gets it wrong?" },
  { href: "#ssa-examples", label: "Checked against Social Security's own examples", look: "12 of 13 match SSA's answers; Claude alone, 9 of 13." },
  { href: "/organizations", label: "A fund pays many families", look: "One PayPal Payouts batch, each item paid straight to a shop or ABLE account, confirmed in PayPal's Transaction Search." },
  { href: "/dashboard", label: "Maya's year in AG Studio", look: "Every gift and her check each month, compared with cash. Press a giver and the Giftwise widget reruns the rules." },
  { href: "#failure-cases", label: "Eight failure cases", look: "Declined card, double click, a browser changing the amount, refunds and more, run live." },
  { href: "/stack#paypal-apis", label: "Every PayPal API it calls", look: "13 PayPal APIs and tools, each with its job and file." },
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
      ["/g/maya/calendar", "Her benefit calendar"],
    ],
  },
  {
    name: "Potential impact",
    where: `About ${facts.audience.ssi_recipients.value} people receive SSI (September 2026). Gifts given as cash can lower the check. Every answer cites the regulation or SSA's operating manual. Outside the sandbox, shops join through PayPal's partner onboarding and ABLE gifts go through each plan's own gift page; the answers cite PayPal's and the plans' own documents.`,
    links: [
      ["/learn", "The rules, explained"],
      ["/about#real", "How this works for real"],
    ],
  },
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
                <p className="jp-head">
                  <Link className="jp-link" href={p.href}>
                    {p.label}
                  </Link>
                  <span className="jp-time tabular muted">{p.time}</span>
                </p>
                <p>{p.look}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="jp-login" data-ui>
          <p className="jp-login-k">Sandbox buyer login, for step 2</p>
          <p className="muted">A PayPal sandbox test account. It works only in PayPal&rsquo;s sandbox checkout window, and no real money moves.</p>
          <Suspense fallback={null}>
            <SandboxLogin />
          </Suspense>
        </div>
        <h3 className="jp-more-h">If you have more time</h3>
        <ul className="jp-more">
          {MORE.map((m) => (
            <li key={m.label}>
              <Link className="text-link" href={m.href}>
                {m.label}
              </Link>
              <span className="muted"> {m.look}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="nightly" className="page-section" aria-labelledby="nightly-h">
        <div className="title-row">
          <h2 id="nightly-h">Checked every night, from outside</h2>
          <Info id="judges.nightly" label="" />
        </div>
        <p className="page-prose jp-intro">
          A Render Workflow opens every page on the path above, calls the public API, and runs each failure case against the PayPal sandbox. Each check is its own task on its own instance, retried if PayPal&rsquo;s sandbox hiccups, and the results land here.
        </p>
        <Suspense fallback={<p className="page-loading">Loading the latest run…</p>}>
          <NightlyChecks />
        </Suspense>
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

      <section id="ssa-examples" className="page-section" aria-labelledby="ssa-ex-h">
        <div className="title-row">
          <h2 id="ssa-ex-h">Checked against Social Security&rsquo;s own examples</h2>
          <Info id="judges.ssa_examples" label="" />
        </div>
        <p className="page-prose jp-intro">
          The 20 bills above were labeled by us. These cases come from Social Security&rsquo;s operating manual, with SSA&rsquo;s own answers. Both the rules engine and Claude with no rulebook
          answered them.
        </p>
        <SsaExamples />
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
