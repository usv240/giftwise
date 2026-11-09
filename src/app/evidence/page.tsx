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
import { Impact } from "@/components/evidence/Impact";
import { TourStart } from "@/components/tour/Tour";
import { SandboxLogin } from "@/components/SandboxLogin";
import { WhatIsNew } from "@/components/WhatIsNew";
import { WhatIsFirst } from "@/components/evidence/WhatIsFirst";
import { CASES } from "@/lib/cases/list";
import { ERROR_RATES } from "@/lib/error-rates";
import heldOut from "../../../content/eval/held-out-results.json";
import { ASKED_SENTENCE, FAMILY_SENTENCE, IMPACT, KEPT_SENTENCE, sampleYearSentence } from "@/lib/impact";
import { RECORDED_RECEIPT } from "@/lib/sample-receipt";
import "../pages.css";
import "../developers/dev.css";
import "./evidence.css";

export const metadata: Metadata = { title: "Evidence", description: "One result line, a five-minute path through the product, and every result in five groups, each with where it comes from." };

const whole = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * The result line the page opens with: the three numbers in one sentence, each computed from the files in content/
 * (src/lib/error-rates.ts, content/eval/ssa-examples-results.json, src/lib/impact.ts).
 */
const RESULT_LINE = `${ERROR_RATES.lowered.errors} of ${ERROR_RATES.lowered.of} gifts that would lower the check were let through; ${ssaResults.summary.engine_matches} of ${ssaResults.summary.cases} of Social Security's own worked examples match SSA's answer; in ${IMPACT.routedCases} of ${IMPACT.scoredCases} real court cases, the same help routed through Giftwise would have kept ${whole(IMPACT.keptMin)} to ${whole(IMPACT.keptMax)} a month.`;

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
const SAMPLE_RECEIPT = `/r/${RECORDED_RECEIPT.order_id}`;

/**
 * Every result and every place to look, under five headings, each row a link to the page that shows it in full. Each
 * row keeps the id its section had on this page, so an old link such as /evidence#field-cases still lands on it.
 */
const INDEX = [
  {
    title: "Does it get the rules right?",
    href: "/evidence/rules",
    rows: [
      { id: "ssa-examples", href: "/evidence/ssa-examples", label: "Social Security's own examples", what: `${ssaResults.summary.engine_matches} of ${ssaResults.summary.cases} match SSA's answer; Claude with no rulebook, ${ssaResults.summary.claude_matches} of ${ssaResults.summary.claude_answered}.` },
      { id: "held-out", href: "/evidence/ssa-examples#held-out", label: "Examples the engine never saw", what: `${heldOut.summary.engine_matches} of ${heldOut.summary.cases} worked examples from SSA's own pages, run on the engine frozen at ${heldOut.engine.commit}.` },
      { id: "field-cases", href: "/evidence/court-cases", label: "Real cases from federal courts", what: `${fieldResults.summary.agreed} of ${fieldResults.summary.scored} reach the outcome SSA and the court did.` },
      { id: "evaluation", href: "/evidence/rules#evaluation", label: "The two reviewers, measured", what: `${billResults.summary.referee.check_kept_whole} of ${billResults.summary.referee.all_cases} labeled bills keep her check whole, with each reviewer alone shown beside the referee.` },
      { id: "referee", href: "/evidence/rules#referee", label: "The referee, under pressure", what: "A wrong quote, a quote from the wrong rulebook, a right answer with a made-up citation, and two reviewers who disagree: what the code does with each, and the check whole every time." },
      { id: "errors", href: "/evidence/rules#errors", label: "The two errors that cost money", what: `${ERROR_RATES.lowered.errors} of ${ERROR_RATES.lowered.of} let through that would lower the check; ${ERROR_RATES.held.errors} of ${ERROR_RATES.held.of} fine gifts sent another way, each with the check whole.` },
      { id: "invariants", href: "/evidence/rules#invariants", label: `${invResults.gifts.toLocaleString("en-US")} random gifts`, what: `Every one keeps all ${invResults.results.length} promises: every cent placed, her check exactly as with no gift, ABLE within its yearly limit.` },
      { id: "rules-watch", href: "/evidence/rules#rules-watch", label: "The rules watch the Federal Register", what: "Asked live for every change to SSI's income rules and amounts since 2022; the 2027 amounts are in use." },
      { id: "ai", href: "/evidence/rules#ai", label: "What the AI never decides", what: "How much each payee gets, which rule applies, the check, when money moves, who is paid and the report: code, every time." },
    ],
  },
  {
    title: "Does the money go only where the rules say?",
    href: "/stack#paypal-apis-all",
    rows: [
      { id: "receipt", href: SAMPLE_RECEIPT, label: "A receipt you can read without paying", what: "A recorded sandbox gift, seeded with the sample page: every payee and capture id, the rule behind each line, and Check with PayPal now asks PayPal for the order live." },
      { id: "verify", href: "/g/maya/report?month=2026-11#rp-verify-h", label: "A report anyone can check", what: "After a gift on Maya's page, November's report carries a QR code: Giftwise rebuilds it, asks PayPal for each payment live and checks the audit ledger." },
      { id: "bill-live", href: "/try/presets/electric-bill#read-live", label: "Claude reads a bill, live", what: "Press Read this bill live: Claude reads the sample bill now, within the daily AI budget, and the rules engine routes it." },
      { id: "paypal-apis", href: "/stack#paypal-apis-all", label: "Every PayPal API it calls", what: "One order paying several payees, capture once with PayPal-Request-Id, approval links for agents, Payouts, Transaction Search and signed webhooks, each with its file." },
      { id: "transcripts", href: "/evidence/operations#transcripts", label: "The PayPal suites, step by step", what: "The checkout and API suites write a redacted transcript: each step with its PayPal order and capture ids, payee count, statuses and timings." },
      { id: "failure-cases", href: "/evidence/operations#failure-cases", label: `${CASES.length} failure cases, run live`, what: "A declined card, a double click, a browser changing the amount, refunds and more, against the PayPal sandbox." },
      { id: "monthly", href: "/g/maya", label: "Give every month", what: "After a gift, press Give this every month: the same amount is routed again each month, with what changed and why." },
      { id: "organizations", href: "/organizations", label: "A fund pays many families", what: "One PayPal Payouts batch, each item paid straight to a shop or ABLE account, confirmed in PayPal's Transaction Search." },
      { id: "able-real", href: "/g/maya#able-real-h", label: "The ABLE share, for real", what: "PayPal settles the shops; the ABLE share goes through the plan's own gift page, by Ugift code or gifting link. The gift page and every receipt with an ABLE line show the hand-off step by step." },
    ],
  },
  {
    title: "What it changes",
    href: "/evidence/impact",
    rows: [
      { id: "stake", href: "/evidence/impact#stake", label: "The problem, measured by Social Security", what: "454,843 checks lowered for shelter help in December 2024, by $247 a month on average; in-kind support 8.59 percent of SSI improper payments; no tools to find living arrangement errors; the $2,000 limit and ABLE's reach, each from its source with the date." },
      { id: "kept", href: "/evidence/impact#kept", label: "What routing would have kept", what: `${KEPT_SENTENCE} ${FAMILY_SENTENCE}` },
      { id: "why", href: "/evidence/impact#why", label: "Why not pay the shop yourself?", what: sampleYearSentence() },
      { id: "asked", href: "/evidence/impact#asked", label: "What SSA asked back", what: ASKED_SENTENCE },
      { id: "reach", href: "/evidence/impact#reach", label: "Who each route reaches", what: `Items, care and school for all ${facts.audience.ssi_jan2025_total.value} people on SSI; rent and utilities through ABLE, where the disability began before ${facts.values.able_onset_age.value}.` },
      { id: "compare", href: "/evidence/impact#compare", label: "How it compares", what: "True Link, Purple, Talli, TrustHelm, Giftly, ABLE gift pages, trusts, DB101, WIPA counselors and fundraising sites, each from its own pages with the one step Giftwise adds." },
      { id: "adoption", href: "/evidence/impact#adoption", label: "Who runs it first", what: "Benefits counselors, state ABLE programs and payee organizations, and a 120-day pilot." },
    ],
  },
  {
    title: "Running it",
    href: "/evidence/operations",
    rows: [
      { id: "nightly", href: "/evidence/operations#nightly", label: "Checked every night, from outside", what: "Every page on the path, the public API, a gift paid by test card across its payees, and each failure case, on Render Workflows." },
      { id: "tests", href: "/evidence/operations#tests", label: "Test results", what: `${results.suites.length} suites, each with its command and date; WCAG 2.2 AA on ${A11Y.total} page views.` },
      { id: "load", href: "/evidence/operations#load", label: "Under load", what: `On the deployed site and on a laptop. Deployed, one visitor at a time: Maya's page in ${loadHosted.paths.find((p) => p.id === "gift-page")!.one_at_a_time_p50_ms} ms.` },
      { id: "status", href: "/status", label: "Status and Operations", what: "Every service, latency and errors by route, payments and webhooks, and the alerts, public on two pages." },
      { id: "real", href: "/evidence/operations#real", label: "Running it for real", what: "What the demo runs on, and what a real deployment changes, file by file." },
    ],
  },
  {
    title: "How it is built and designed",
    href: "/stack",
    rows: [
      { id: "parts", href: "/stack", label: "How it is built", what: "Every sponsor tool and PayPal API with its job and file, and Claude's structured outputs checked by the rules engine." },
      {
        id: "design",
        href: "/g/maya",
        label: "Designed for the people who use it",
        what: `Built to W3C's guidance for cognitive and learning disabilities, Easy Read, GOV.UK confirmation pages and Baymard's checkout research. Light and dark, Large text, Spanish for givers, WCAG 2.2 AA on ${A11Y.total} page views.`,
      },
      { id: "ask", href: "/learn", label: "Ask the rulebook", what: "Elasticsearch finds the passages, Claude answers only from them, and every quote is checked word for word." },
      { id: "organizer", href: "/manage/maya-sample-organizer", label: "The organizer's side", what: "Add or change a need and watch Giftwise choose where it is paid, find a product with Channel3, and send each gift to a Zapier webhook." },
      { id: "calendar", href: "/g/maya/calendar?month=2026-10", label: "The calendar's planner", what: "Press As cash, then Plan the cash dates: the planner moves gifts on the Bryntum calendar and compares the result with paying the shop." },
      { id: "dashboard", href: "/dashboard", label: "Maya's year in AG Studio", what: "Every gift and her check each month, compared with cash; press a giver and the Giftwise widget reruns the rules." },
      { id: "sample", href: "/g/maya", label: "A sample you can reset", what: "Maya's page resets to the same starting point at any time, and every earlier receipt still opens." },
    ],
  },
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
        <p className="lede ev-result">{RESULT_LINE}</p>
      </header>

      {/* Ninety seconds: the path as six links, one action, and everything else one press away. */}
      <section id="path" className="page-section ev-90" aria-labelledby="path-h">
        <h2 id="path-h">The five-minute path</h2>
        <ol className="ev-path" aria-label="The six steps, in order">
          {PATH.map((p) => (
            <li key={p.label}>
              <Link className="ev-path-link" href={p.href}>
                {p.label} <span className="ev-path-time tabular muted">{p.time}</span>
              </Link>
            </li>
          ))}
        </ol>
        <div className="ev-act">
          <Link href="/g/maya" className="btn btn-primary">
            Open Maya&rsquo;s page and give in the sandbox
          </Link>
          <Link className="text-link" href={SAMPLE_RECEIPT}>
            Or read a sample receipt without paying
          </Link>
        </div>
        <div className="jx-more">
          <details className="jx-disc" id="path-detail">
            <summary>What to look for at each step, the sandbox buyer login, and the guided tour</summary>
            <div className="jx-body">
              <p className="jp-tour">
                <TourStart /> <span className="muted">Eight stops in this tab, about five minutes. Escape ends it.</span>
              </p>
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
                  <p className="muted">It works only in PayPal&rsquo;s sandbox checkout window, and no real money moves.</p>
                </div>
                <SandboxLogin />
              </div>
            </div>
          </details>
        </div>
      </section>

      <Impact />
      <p className="page-prose jp-intro ev-paypal">
        PayPal is where the rules are enforced: money reaches only a payee the rules picked, in one order, captured once, and anyone can check a month&rsquo;s report against PayPal.
      </p>

      <WhatIsNew headingId="new-h" className="page-section" />

      <WhatIsFirst headingId="first-h" className="page-section" />

      <section id="results" className="page-section" aria-labelledby="index-h">
        <h2 id="index-h">Every result, in five groups</h2>
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
    </div>
  );
}
