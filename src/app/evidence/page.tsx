import type { Metadata } from "next";
import Link from "next/link";
import facts from "../../../content/facts.json";
import results from "../../../content/test-results.json";
import billResults from "../../../content/eval-results.json";
import fieldResults from "../../../content/eval/field-cases-results.json";
import ssaResults from "../../../content/eval/ssa-examples-results.json";
import invResults from "../../../content/eval/invariants-results.json";
import loadHosted from "../../../content/public/load-test-hosted.json";
import { Info } from "@/components/Info";
import { OpenOnHash } from "@/components/OpenOnHash";
import { Impact } from "@/components/judges/Impact";
import { TourStart } from "@/components/tour/Tour";
import { SandboxLogin } from "@/components/SandboxLogin";
import { WhatIsNew } from "@/components/WhatIsNew";
import { CASES } from "@/lib/cases/list";
import { ERROR_RATES } from "@/lib/error-rates";
import { ASKED_SENTENCE, KEPT_SENTENCE, payItYourself } from "@/lib/impact";
import "../pages.css";
import "../developers/dev.css";
import "./evidence.css";

export const metadata: Metadata = { title: "Evidence", description: "Three numbers, a five-minute path through the product, and every result on its own page with where it comes from." };

/** The five-minute path: six steps, under a minute and a half each, in the order the story runs. */
const PATH = [
  { href: "/", label: "The problem in one number", time: "20 s", look: "In the Gift Checker, $1,000 sent as cash cuts her check two months later. Press Pay the shop: she keeps all of it." },
  { href: "/g/maya", label: "Give, and pay in the sandbox", time: "90 s", look: "Type $1,500 in Give any amount. The rules split it across her needs and her ABLE account, and one PayPal checkout pays all five recipients. Pay with the sandbox buyer below, or as a guest with PayPal's test card, then open the receipt." },
  { href: "/g/maya/report?month=2026-10", label: "Her report to Social Security", time: "40 s", look: "SSI asks for changes in income by the 10th. October's report says nothing counts, with the rule behind every gift. Press As cash: the same gifts would have counted $538 and cut her check to $456." },
  { href: "/g/maya/report/easy?month=2026-10", label: "Her own copy, in Easy Read", time: "20 s", look: "The same report written to Maya: the answer first, then one idea per line with a picture beside each. Press En español, and Remind me by the 10th for a calendar reminder." },
  { href: "/agents", label: "An AI assistant asks first", time: "40 s", look: "A Claude assistant with no SSI knowledge calls the Giftwise MCP server, talks June out of sending cash, starts a checkout only she can approve, and reads the order back from PayPal." },
  { href: "/g/maya/calendar?month=2026-10", label: "Her benefit calendar", time: "40 s", look: "Press As cash and drag Aunt June's $150 from October 28 to November 2. A different check drops: SSI counts income by calendar month." },
];

const A11Y = results.suites.find((s) => s.id === "a11y")!;
const YEAR = payItYourself();
const usd0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * Every result, on the page that shows it in full. Each row keeps the id its section had on this page, so an old
 * link such as /evidence#field-cases still lands on that result and its link.
 */
const INDEX = [
  {
    title: "How the rules were checked",
    href: "/evidence/rules",
    rows: [
      { id: "ssa-examples", href: "/evidence/ssa-examples", label: "Social Security's own examples", what: `${ssaResults.summary.engine_matches} of ${ssaResults.summary.cases} match SSA's answer; Claude with no rulebook, ${ssaResults.summary.claude_matches} of ${ssaResults.summary.claude_answered}.` },
      { id: "field-cases", href: "/evidence/court-cases", label: "Real cases from federal courts", what: `${fieldResults.summary.agreed} of ${fieldResults.summary.scored} reach the outcome SSA and the court did.` },
      { id: "evaluation", href: "/evidence/rules#evaluation", label: "The two reviewers, measured", what: `${billResults.summary.referee.check_kept_whole} of ${billResults.summary.referee.all_cases} labeled bills keep her check whole; Claude with no rulebook, ${billResults.summary.baseline.check_kept_whole}.` },
      { id: "errors", href: "/evidence/rules#errors", label: "The two errors that cost money", what: `${ERROR_RATES.lowered.errors} of ${ERROR_RATES.lowered.of} let through that would lower the check; ${ERROR_RATES.held.errors} of ${ERROR_RATES.held.of} fine gifts sent another way, each with the check whole.` },
      { id: "invariants", href: "/evidence/rules#invariants", label: `${invResults.gifts.toLocaleString("en-US")} random gifts`, what: `Every one keeps all ${invResults.results.length} promises: every cent placed, her check exactly as with no gift, ABLE within its yearly limit.` },
      { id: "rules-watch", href: "/evidence/rules#rules-watch", label: "The rules watch the Federal Register", what: "Asked live for every change to SSI's income rules and amounts since 2022; the 2027 amounts are in use." },
      { id: "ai", href: "/evidence/rules#ai", label: "What the AI never decides", what: "How much each payee gets, which rule applies, the check, when money moves, who is paid and the report: code, every time." },
    ],
  },
  {
    title: "Running it",
    href: "/evidence/operations",
    rows: [
      { id: "nightly", href: "/evidence/operations#nightly", label: "Checked every night, from outside", what: "Every page on the path, the public API, a gift paid by test card across its payees, and each failure case, on Render Workflows." },
      { id: "failure-cases", href: "/evidence/operations#failure-cases", label: `${CASES.length} failure cases, run live`, what: "A declined card, a double click, a browser changing the amount, refunds and more, against the PayPal sandbox." },
      { id: "tests", href: "/evidence/operations#tests", label: "Test results", what: `${results.suites.length} suites, each with its command and date; WCAG 2.2 AA on ${A11Y.total} page views.` },
      { id: "load", href: "/evidence/operations#load", label: "Under load", what: `On the deployed site and on a laptop. Deployed, one visitor at a time: Maya's page in ${loadHosted.paths.find((p) => p.id === "gift-page")!.one_at_a_time_p50_ms} ms.` },
      { id: "real", href: "/evidence/operations#real", label: "Running it for real", what: "What the demo runs on, and what a real deployment changes, row by row." },
    ],
  },
  {
    title: "What it changes",
    href: "/evidence/impact",
    rows: [
      { id: "kept", href: "/evidence/impact#kept", label: "What routing would have kept", what: KEPT_SENTENCE },
      { id: "asked", href: "/evidence/impact#asked", label: "What SSA asked back", what: ASKED_SENTENCE },
      { id: "reach", href: "/evidence/impact#reach", label: "Who each route reaches", what: `A shop route for all ${facts.audience.ssi_jan2025_total.value} people on SSI; ABLE where the disability began before ${facts.values.able_onset_age.value}.` },
      { id: "why", href: "/evidence/impact#why", label: "Why not pay the shop yourself?", what: `On the sample year, each giver paying alone lowers ${YEAR.monthsLowered} of her checks, ${usd0(YEAR.totalLowered)} in all.` },
      { id: "compare", href: "/evidence/impact#compare", label: "How it compares", what: "Prepaid cards, trusts, benefits calculators and counselors, fundraising sites and more, from their own pages." },
      { id: "adoption", href: "/evidence/impact#adoption", label: "Who runs it first", what: "Benefits counselors, state ABLE programs and payee organizations, and a 120-day pilot." },
    ],
  },
  {
    title: "How it is built and designed",
    href: "/stack",
    rows: [
      {
        id: "parts",
        href: "/stack",
        label: "How it is built",
        what: "One PayPal order paying several payees, server-side capture with idempotency, approval links for agents, Payouts with Transaction Search, signature-checked webhooks, PayPal's MCP server, and Claude's structured outputs checked by the rules engine.",
      },
      {
        id: "design",
        href: "/g/maya",
        label: "Designed for the people who use it",
        what: `Built to W3C's guidance for cognitive and learning disabilities, NHS England and Inclusion Europe Easy Read, GOV.UK confirmation pages and Baymard's checkout research. Light and dark, Large text, Spanish for givers, 44-pixel targets, WCAG 2.2 AA on ${A11Y.total} page views.`,
      },
      { id: "status", href: "/status", label: "Status and Operations", what: "Every service, latency and errors by route, payments and webhooks, and the alerts, public on two pages." },
      { id: "sample", href: "/g/maya", label: "A sample you can reset", what: "Maya's page resets to the same starting point at any time, and every earlier receipt still opens." },
    ],
  },
];

/** More to try, for a visitor with more time. */
const MORE = [
  { href: "/try/presets/electric-bill", label: "Claude reads a bill; two reviewers check it", look: "Two Claude reviewers with different rulebooks must quote them word for word. Press What if a reviewer gets it wrong?" },
  { href: "/g/maya/report?month=2026-11#rp-verify-h", label: "A report anyone can check", look: "After the gift in step 2, November's report carries a QR code. Open it: Giftwise rebuilds the report, asks PayPal for each payment live and checks the audit ledger." },
  { href: "/g/maya", label: "Give every month", look: "After a gift on Maya's page, press Give this every month: the same amount is routed again each month, with what changed and why." },
  { href: "/g/maya/calendar?month=2026-10", label: "The calendar's planner", look: "Press As cash, then Plan the cash dates: the planner moves gifts on the Bryntum calendar itself and compares the result with paying the shop." },
  { href: "/stack#paypal-apis-all", label: "Every PayPal API it calls", look: "Each PayPal API and tool, with its job and file." },
  { href: "/organizations", label: "A fund pays many families", look: "One PayPal Payouts batch, each item paid straight to a shop or ABLE account, confirmed in PayPal's Transaction Search." },
  { href: "/manage/maya-sample-organizer", label: "The organizer's side", look: "Add or change a need and watch Giftwise choose where it is paid, find a product with Channel3, see gifts arrive, and send each one to a Zapier webhook." },
  { href: "/dashboard", label: "Maya's year in AG Studio", look: "Every gift and her check each month, compared with cash. Press a giver and the Giftwise widget reruns the rules." },
  { href: "/learn", label: "Ask the rulebook", look: "A question in plain words: Elasticsearch finds the passages, Claude answers only from them, and every quote is checked word for word." },
];

export default function EvidencePage() {
  return (
    <div className="page frame evidence">
      <OpenOnHash />
      <header className="page-head">
        <div className="title-row">
          <h1 className="page-title">Evidence</h1>
          <Info id="page.evidence" />
        </div>
        <p className="lede">Three numbers, the five-minute path, and every result on its own page, with where it comes from.</p>
        <p className="jp-tour">
          <TourStart /> <span className="muted">Eight stops in this tab, about five minutes. Escape ends it.</span>
        </p>
      </header>

      <Impact />

      <section id="path" className="page-section" aria-labelledby="path-h">
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
          <div>
            <p className="jp-login-k">Sandbox buyer login, for step 2</p>
            <p className="muted">A PayPal sandbox test account. It works only in PayPal&rsquo;s sandbox checkout window, and no real money moves.</p>
          </div>
          <SandboxLogin />
        </div>
      </section>

      <WhatIsNew headingId="new-h" className="page-section" />

      <section id="results" className="page-section" aria-labelledby="index-h">
        <h2 id="index-h">Every result, on its own page</h2>
        <div className="ev-index">
          {INDEX.map((g) => (
            <div key={g.title}>
              <h3>
                <Link className="text-link" href={g.href}>
                  {g.title}
                </Link>
              </h3>
              <ul>
                {g.rows.map((r) => (
                  <li key={r.id} id={r.id}>
                    <Link className="text-link" href={r.href}>
                      {r.label}
                    </Link>
                    <span className="ev-index-what muted">{r.what}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="more" className="page-section" aria-labelledby="more-h">
        <h2 id="more-h">If you have more time</h2>
        <div className="jx-more">
          <details className="jx-disc">
            <summary>{MORE.length} more places to look, with what to look for at each</summary>
            <div className="jx-body">
              <ul className="jp-more">
                {MORE.map((m) => (
                  <li key={m.label}>
                    <Link className="text-link jp-more-link" href={m.href}>
                      {m.label}
                    </Link>
                    <span className="jp-more-look muted">{m.look}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}
