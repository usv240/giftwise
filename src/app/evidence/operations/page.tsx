import type { Metadata } from "next";
import Link from "next/link";
import results from "../../../../content/test-results.json";
import loadLaptop from "../../../../content/public/load-test.json";
import loadHosted from "../../../../content/public/load-test-hosted.json";
import transcripts from "../../../../content/eval/e2e-transcripts.json";

type TranscriptStep = { step: string; at_ms: number; ok?: boolean; order_id?: string; batch_id?: string; capture_ids?: string[]; payees?: number; status?: string; paypal_status?: string; amount?: number | string; note?: string };
type Transcript = { ran_at: string; against: string; passed: number; failed: number; total_ms: number; steps: TranscriptStep[] };
/** The recorded transcripts, the checkout suite first. */
const TRANSCRIPTS = Object.entries((transcripts as { suites: Record<string, Transcript> }).suites).sort(([a], [b]) => (a === "paypal" ? -1 : b === "paypal" ? 1 : a.localeCompare(b)));
import { Info } from "@/components/Info";
import { VAULT_FINDING } from "@/lib/monthly";
import { OpenOnHash } from "@/components/OpenOnHash";
import { CaseRunner } from "@/components/evidence/CaseRunner";
import { NightlyChecks } from "@/components/evidence/NightlyChecks";
import { latestRun, suiteRows } from "@/lib/test-results";
import "../../pages.css";
import "../../developers/dev.css";
import "../evidence.css";

export const metadata: Metadata = {
  title: "Running it",
  description: "The nightly outside checks, failure cases run live against the PayPal sandbox, every test suite, the load test on a laptop and on the deployed site, and what a real deployment changes.",
};

/** A YYYY-MM-DD date in words, the same on any server. */
const day = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" });

/** What the demo runs on, and what a real deployment changes. Each row is an operating range with a known next step. */
const REAL: [string, string][] = [
  ["One Render Starter web instance (0.5 CPU, 512 MB), always on", "Several instances with autoscaling; rate limits and the request log already live in Postgres, so nothing is per instance"],
  ["One 256 MB Postgres with a 1 GB disk, no pooler", "A larger Postgres with a connection pooler, point-in-time recovery, and a restore tested on a schedule"],
  ["Share images rendered on request; no uploads kept", "Object storage with signed URLs for anything a family uploads, never the database"],
  ["About $2 of Claude a day, capped and shown on the Operations page", "A budget per organization, with the same per-call accounting"],
  ["No login: the organizer's page is a private link shown once and stored as a hash; the organizations page is a sample fund", "Login and roles for organizations, with the manage link kept for families"],
  ["One PayPal sandbox app and one webhook; PAYPAL_ENV=sandbox (src/lib/paypal/env.ts)", "PAYPAL_ENV=live with the live app's keys and a webhook per environment, each with its own webhook id"],
  ["Shops paid by payee.email_address; Partner Referrals answers this sandbox app 403 NOT_AUTHORIZED", "Each shop onboarded through Partner Referrals once PayPal approves the partner account, and paid by payee.merchant_id (src/lib/paypal/orders.ts, src/lib/households.ts)"],
  ["The ABLE share paid to a sandbox business account standing in for the plan", "The ABLE share sent to the plan's own gift page, the shops still paid through PayPal"],
  ["Nightly outside checks on Render Workflows; errors as JSON log lines", "The same checks on every deploy, plus Sentry for server, edge and browser errors with personal data masked"],
];

const RUNS = [
  { where: "On the deployed site", run: loadHosted },
  { where: "On a laptop", run: loadLaptop },
] as const;

export default function OperationsPage() {
  // Each suite as recorded, the invariant run read from its own results file (src/lib/test-results.ts).
  const suites = suiteRows();
  return (
    <div className="page frame evidence evidence-sub">
      <OpenOnHash />
      <header className="page-head">
        <p className="jx-crumb">
          <Link className="text-link" href="/evidence">
            Evidence
          </Link>
        </p>
        <h1 className="page-title">Running it</h1>
        <p className="lede">The checks that run every night from outside, the failure cases you can run now, every test suite, and how it holds under load.</p>
      </header>

      <section id="nightly" className="page-section jx" aria-labelledby="nightly-h">
        <div className="jx-head">
          <div className="title-row">
            <h2 id="nightly-h">Checked every night, from outside</h2>
            <Info id="evidence.nightly" label="" />
          </div>
          <p className="page-prose jp-intro">
            A Render Workflow opens every page on the five-minute path, calls the public API, pays a gift split across its payees with a sandbox test card, and runs each failure case against the PayPal
            sandbox. Each check is its own task, retried if PayPal&rsquo;s sandbox hiccups, and the results land here.
          </p>
        </div>
        <NightlyChecks />
      </section>

      <section id="failure-cases" className="page-section jx" aria-labelledby="cases-h">
        <div className="jx-head">
          <div className="title-row">
            <h2 id="cases-h">Failure cases, run live</h2>
            <Info id="evidence.cases" label="" />
          </div>
          <p className="page-prose jp-intro">Payments fail in ordinary ways: a declined card, a double click, a browser that sends the wrong amount. Each check below runs the real code against the PayPal sandbox.</p>
        </div>
        <CaseRunner />
      </section>

      <section id="tests" className="page-section" aria-labelledby="tests-h">
        <div className="title-row">
          <h2 id="tests-h">Test results</h2>
          <Info id="evidence.tests" label="" />
        </div>
        <p className="page-prose jp-intro">
          Latest run {day(latestRun())}; each suite&rsquo;s own date is with its command. {results.build}. The counts are written by scripts/test-results.mjs after each run, and the README
          and TESTING.md are checked against the same file.
        </p>
        <ul className="jp-tests" aria-label="Each suite, passed of total">
          {suites.map((s) => (
            <li key={s.id} className="jp-test">
              <span className="jp-test-name">{s.name}</span>
              <span className="jp-test-score tabular">
                {s.passed.toLocaleString("en-US")}/{s.total.toLocaleString("en-US")}
              </span>
            </li>
          ))}
        </ul>
        <div className="jx-more">
          <details className="jx-disc">
            <summary>What each checks, and its command</summary>
            <div className="jx-body">
              <ul className="jp-test-whats">
                {suites.map((s) => (
                  <li key={s.id}>
                    <p className="jp-test-name">
                      {s.name}{" "}
                      <span className="jp-test-of tabular">
                        {s.passed.toLocaleString("en-US")}/{s.total.toLocaleString("en-US")}
                      </span>
                    </p>
                    <p className="jp-test-what">{s.what}</p>
                    <p className="jp-test-cmd tabular">
                      {s.command}, {day(s.ranAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      </section>

      <section id="transcripts" className="page-section" aria-labelledby="transcripts-h" data-check-year="">
        <div className="title-row">
          <h2 id="transcripts-h">The PayPal suites, step by step</h2>
          <Info id="evidence.tests" label="" />
        </div>
        <p className="page-prose jp-intro">
          The two suites that move sandbox money write a redacted transcript as they run, in content/eval/e2e-transcripts.json: each step with its PayPal order and capture ids, how many payees, the
          statuses PayPal reported and the timings. No address, key or token is kept. A GitHub Actions workflow (PayPal checkout, sandbox) runs the checkout suite on request when the sandbox secrets
          are set on the repository. A check named in a step is at its year&rsquo;s rate: the full amount is $994 in 2026 and $1,029 from January 2027.
        </p>
        {TRANSCRIPTS.length === 0 ? (
          <p className="page-prose muted">No transcript recorded yet.</p>
        ) : (
          <div className="jx-more">
            {TRANSCRIPTS.map(([id, t]) => (
              <details key={id} className="jx-disc">
                <summary>
                  {id === "paypal" ? "Real PayPal checkout, logged in as the sandbox buyer" : "API end to end"}: {t.passed} of {t.passed + t.failed}, {day(t.ran_at)}, {t.steps.length} steps in{" "}
                  {(t.total_ms / 1000).toFixed(1)} s
                </summary>
                <div className="jx-body">
                  <p className="jp-test-what">Run against {t.against}. Steps that name a PayPal order or capture are shown with their ids; the rest are the suite&rsquo;s own checks.</p>
                  <div className="doc-table-wrap" tabIndex={0} role="region" aria-label={`${id} transcript`}>
                    <table className="doc-table">
                      <thead>
                        <tr>
                          <th scope="col">Step</th>
                          <th scope="col">PayPal</th>
                          <th scope="col" className="num">
                            At
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.steps.map((s, i) => (
                          <tr key={i}>
                            <td>
                              {s.ok === false ? "Failed: " : ""}
                              {s.step}
                              {s.note && <span className="ev-basis">{s.note}</span>}
                            </td>
                            <td className="tabular">
                              {[s.order_id && `order ${s.order_id}`, s.batch_id && `batch ${s.batch_id}`, s.payees !== undefined && `${s.payees} ${s.payees === 1 ? "payee" : "payees"}`, (s.paypal_status ?? s.status) && String(s.paypal_status ?? s.status), s.capture_ids?.length ? `captures ${s.capture_ids.join(", ")}` : null]
                                .filter(Boolean)
                                .join("; ")}
                            </td>
                            <td className="tabular num">{(s.at_ms / 1000).toFixed(1)} s</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <section id="load" className="page-section" aria-labelledby="load-h">
        <div className="title-row">
          <h2 id="load-h">Under load</h2>
          <Info id="evidence.load" label="" />
        </div>
        <p className="page-prose jp-intro">
          Visitors at once, each checking a gift and opening Maya&rsquo;s page, measured twice: gently on the deployed site, and harder on a laptop running the production build. Beside them, the ledger race
          test fires 60 appends at once and the hash chain verifies.
        </p>
        {RUNS.map(({ where, run }) => (
          <div key={where}>
            <p className="ev-load-where">
              {where}: {run.concurrency} visitors at once, {run.rounds} rounds, {run.total_requests.toLocaleString("en-US")} requests in {(run.total_ms / 1000).toFixed(1)} seconds, {day(run.ran_at)}
            </p>
            <ul className="jp-tests" aria-label={`${where}: each path, with its latency and error rate`}>
              {run.paths.map((p) => (
                <li key={p.id} className="jp-test">
                  <span className="jp-test-name">{p.label}</span>
                  <span className="jp-test-score jp-load-score tabular">
                    p50 {p.p50_ms} ms, p95 {p.p95_ms} ms, p99 {p.p99_ms} ms, {p.errors} of {p.requests} failed
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="jx-more">
          <details className="jx-disc">
            <summary>The exact method and machines</summary>
            <div className="jx-body">
              {RUNS.map(({ where, run }) => (
                <div key={where}>
                  <p className="jp-test-what">
                    <strong>{where}.</strong> {run.method}
                  </p>
                  <p className="jp-test-what">Machine: {run.machine}.</p>
                </div>
              ))}
              <p className="jp-test-what">
                On the deployed site, one visitor at a time, Maya&rsquo;s page answers in {loadHosted.paths.find((p) => p.id === "gift-page")!.one_at_a_time_p50_ms} ms and a gift check in{" "}
                {loadHosted.paths.find((p) => p.id === "check-gift")!.one_at_a_time_p50_ms} ms (p50, network included); with {loadHosted.concurrency} at once, requests wait their turn for its half CPU, which is the
                difference above. Several instances behind Render&rsquo;s load balancer take that wait away (the table below).
              </p>
              <p className="jp-test-cmd tabular">npm run test:load; BASE_URL=https://giftwise-405i.onrender.com LOAD_WHERE=hosted npm run test:load -- 10 3</p>
            </div>
          </details>
        </div>
      </section>

      <section id="real" className="page-section" aria-labelledby="real-h">
        <div className="title-row">
          <h2 id="real-h">Running it for real</h2>
          <Info id="evidence.real" label="" />
        </div>
        <p className="page-prose jp-intro">What the demo runs on today, and what a real deployment changes. Each row is an operating range with a known next step.</p>
        <table className="jp-real">
          <thead>
            <tr>
              <th scope="col">The demo runs on</th>
              <th scope="col">A real deployment changes it to</th>
            </tr>
          </thead>
          <tbody>
            {REAL.map(([now, real]) => (
              <tr key={now}>
                <td>{now}</td>
                <td>{real}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="page-prose jp-intro">
          What stays the same: JSON logs with a request id on every line, limits and logs in Postgres, the audit ledger, the{" "}
          <Link className="text-link" href="/ops">
            Operations page
          </Link>
          , and the Render Workflows fan-out for anything that runs in the background: one task per unit of work, in parallel, with retries.
        </p>
        <p id="monthly-approval" className="page-prose jp-intro">
          Monthly gifts: the giver approves each month in PayPal. {VAULT_FINDING.sentence}
        </p>
      </section>
    </div>
  );
}
