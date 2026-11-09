import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Info } from "@/components/Info";
import { MODE_LABEL, liveSummary, optionalOffSentence } from "@/lib/health";
import { alerts, describeCheckPayments, feed, lastDay, rightNow, week, type HourPoint } from "@/lib/ops";
import { incomeDay, shownAt, shownDay } from "@/lib/time";
import { LiveStream } from "./LiveStream";
import { TraceBox } from "./TraceBox";
import "../pages.css";
import "./ops.css";

export const metadata: Metadata = { title: "Operations", description: "How Giftwise is running right now: every service, request latency and errors, payments and webhooks by status, a live event stream, and the alerts it watches. Nothing on it is private." };

const INFO: Record<string, string> = { database: "render", webhooks: "paypal", checks: "render", "paypal-mcp": "paypal_apis" };
const usd = (v: number) => `$${v.toFixed(2)}`;
const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.01 ? 2 : 1)}%`;

function Proves({ children }: { children: React.ReactNode }) {
  return <p className="ops-proves">{children}</p>;
}

async function RightNow() {
  await connection();
  const now = await rightNow();
  // Optional services that are off are named under the count, not counted: the same summary /status and /api/health use.
  const s = liveSummary(now.checks);
  const rest = s.of - s.live;
  const sub = [
    rest === 0 ? "" : rest === s.fallback ? `${rest} on ${rest === 1 ? "its fallback" : "their fallbacks"}.` : `${rest} not live yet.`,
    optionalOffSentence(s.optionalOff),
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <>
      <ul className="ops-tiles" aria-label="Right now">
        <li className="ops-tile">
          <span className="ops-tile-k">Requests in the last hour</span>
          <span className="ops-tile-v tabular">{now.lastHour.toLocaleString("en-US")}</span>
          <span className="ops-tile-s muted tabular">{now.lastHourErrors ? `${now.lastHourErrors} answered 5xx` : "none answered 5xx"}</span>
        </li>
        <li className="ops-tile">
          <span className="ops-tile-k">AI spend today</span>
          <span className="ops-tile-v tabular">{usd(now.aiToday)}</span>
          <span className="ops-tile-s muted tabular">
            of a {usd(now.aiCap)} cap, {now.aiCallsToday} {now.aiCallsToday === 1 ? "call" : "calls"}
          </span>
          <span className="ops-meter" role="meter" aria-label="AI spend today against its cap" aria-valuemin={0} aria-valuemax={now.aiCap} aria-valuenow={Math.min(now.aiToday, now.aiCap)} aria-valuetext={`${usd(now.aiToday)} of ${usd(now.aiCap)}`}>
            <span className="ops-meter-fill" style={{ width: `${Math.min(100, (now.aiToday / now.aiCap) * 100)}%` }} />
          </span>
        </li>
        <li className="ops-tile">
          <span className="ops-tile-k">Services live</span>
          <span className="ops-tile-v tabular">
            {s.live} of {s.of}
          </span>
          <span className="ops-tile-s muted">{sub || "Every service is live."}</span>
        </li>
      </ul>
      <ul className="status-list ops-health">
        {now.checks.map((c) => (
          <li key={c.id} className="status-row">
            <span className="status-name">
              {c.name} <Info id={`stack.${INFO[c.id] ?? c.id}`} label="" />
            </span>
            <span className="status-detail">
              {c.detail}
              {c.ms ? <span className="tabular"> in {c.ms} ms</span> : null}
            </span>
            <span className="status-mode" data-mode={c.mode}>
              {MODE_LABEL[c.mode]}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

const PAY_LABELS: [string, string][] = [
  ["planned", "Planned"],
  ["paid", "Paid"],
  ["waiting", "Waiting to be accepted"],
  ["returned", "Returned"],
  ["failed", "Failed"],
];

async function LastDay() {
  await connection();
  const d = await lastDay();
  const total = d.routes.reduce((n, r) => n + r.requests, 0);
  return (
    <div className="ops-day">
      <div className="ops-block">
        <h3 className="ops-h3">
          Requests by route <span className="muted tabular">({total.toLocaleString("en-US")})</span>
        </h3>
        {d.routes.length ? (
          <div className="ops-scroll" tabIndex={0} role="region" aria-label="Requests by route, scrolls sideways on a phone">
            <table className="ops-table">
              <thead>
                <tr>
                  <th scope="col">Route</th>
                  <th scope="col" className="num">
                    Requests
                  </th>
                  <th scope="col" className="num">
                    p50
                  </th>
                  <th scope="col" className="num">
                    p95
                  </th>
                  <th scope="col" className="num">
                    Refused
                  </th>
                  <th scope="col" className="num">
                    Errors
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.routes.map((r) => (
                  <tr key={r.route}>
                    <th scope="row" className="ops-route">
                      {r.route}
                    </th>
                    <td className="num tabular">{r.requests.toLocaleString("en-US")}</td>
                    <td className="num tabular">{r.p50} ms</td>
                    <td className="num tabular">{r.p95} ms</td>
                    <td className="num tabular">{r.refused}</td>
                    <td className="num tabular" data-tone={r.errors ? "attention" : undefined}>
                      {r.errors} ({pct(r.errorRate)})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No API requests in the last 24 hours.</p>
        )}
        <p className="ops-note muted">Refused is a 4xx: a bad request or a rate limit, answered on purpose. Errors are 5xx.</p>
      </div>
      <div className="ops-block">
        <h3 className="ops-h3">Payments by status</h3>
        <ul className="ops-counts" aria-label="Payments and payouts in the last 24 hours, by status">
          {PAY_LABELS.map(([k, label]) => (
            <li key={k} className="ops-count">
              <span className="ops-count-v tabular">{(d.payments[k] ?? 0).toLocaleString("en-US")}</span>
              <span className="ops-count-k">{label}</span>
            </li>
          ))}
        </ul>
        <p className="ops-note muted">Gift orders and payout items together, counts only. Paid means captured by PayPal or a payout item that succeeded.</p>
        {describeCheckPayments(d.checkPayments) && <p className="ops-note muted">{describeCheckPayments(d.checkPayments)}</p>}
      </div>
      <div className="ops-block">
        <h3 className="ops-h3">Webhooks</h3>
        <p className="tabular">
          {d.webhooks.received} received, {d.webhooks.handledOnce} handled once, {d.webhooks.duplicates} {d.webhooks.duplicates === 1 ? "duplicate" : "duplicates"} seen again and not reapplied, {d.webhooks.unverified} with a signature PayPal did not verify.
        </p>
      </div>
      <div className="ops-block">
        <h3 className="ops-h3">AI calls by route</h3>
        {d.ai.length ? (
          <div className="ops-scroll" tabIndex={0} role="region" aria-label="AI calls by route, scrolls sideways on a phone">
            <table className="ops-table">
              <thead>
                <tr>
                  <th scope="col">Route</th>
                  <th scope="col" className="num">
                    Calls
                  </th>
                  <th scope="col" className="num">
                    Tokens in
                  </th>
                  <th scope="col" className="num">
                    Tokens out
                  </th>
                  <th scope="col" className="num">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.ai.map((r) => (
                  <tr key={r.route}>
                    <th scope="row" className="ops-route">
                      {r.route}
                    </th>
                    <td className="num tabular">
                      {r.calls}
                      {r.replayed ? <span className="muted"> ({r.replayed} replayed)</span> : null}
                    </td>
                    <td className="num tabular">{r.inputTokens.toLocaleString("en-US")}</td>
                    <td className="num tabular">{r.outputTokens.toLocaleString("en-US")}</td>
                    <td className="num tabular">{usd(r.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No AI calls in the last 24 hours. The ready-made examples answer from saved results.</p>
        )}
      </div>
    </div>
  );
}

async function Stream() {
  await connection();
  return <LiveStream initial={await feed()} />;
}


function WeekChart({ points }: { points: HourPoint[] }) {
  const W = 840;
  const H = 200;
  const top = 12;
  const base = H - 28;
  const max = Math.max(1, ...points.map((p) => p.requests));
  const bw = W / points.length;
  const y = (v: number) => base - (v / max) * (base - top);
  const requests = points.reduce((n, p) => n + p.requests, 0);
  const errors = points.reduce((n, p) => n + p.errors, 0);
  // A tick where a new day starts in Pacific time, the one zone the site shows times in (src/lib/time.ts).
  const days = points.map((p, i) => ({ i, day: incomeDay(p.hour) })).filter(({ day }, i, all) => i > 0 && day !== all[i - 1].day);
  return (
    <figure className="ops-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="ops-chart-title ops-chart-desc" preserveAspectRatio="none">
        <title id="ops-chart-title">Requests and errors per hour, last seven days</title>
        <desc id="ops-chart-desc">
          {requests.toLocaleString("en-US")} requests and {errors.toLocaleString("en-US")} errors over seven days; the busiest hour had {max.toLocaleString("en-US")} requests.
        </desc>
        <line x1={0} y1={base + 0.5} x2={W} y2={base + 0.5} className="ops-axis" />
        {[0.5, 1].map((f) => (
          <g key={f}>
            <line x1={0} y1={y(max * f)} x2={W} y2={y(max * f)} className="ops-grid" />
            <text x={4} y={y(max * f) - 3} className="ops-tick">
              {Math.round(max * f).toLocaleString("en-US")}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <g key={p.hour}>
            {p.requests > 0 && <rect x={i * bw + 0.5} y={y(p.requests)} width={Math.max(1, bw - 1)} height={base - y(p.requests)} className="ops-bar" />}
            {p.errors > 0 && <rect x={i * bw + 0.5} y={y(p.errors)} width={Math.max(1, bw - 1)} height={base - y(p.errors)} className="ops-bar-err" />}
          </g>
        ))}
        {days.map(({ i, day }) => (
          <g key={i}>
            <line x1={i * bw} y1={base} x2={i * bw} y2={base + 5} className="ops-axis" />
            <text x={i * bw + 3} y={H - 8} className="ops-tick">
              {shownDay(day)}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="muted tabular">
        <span className="ops-key ops-key-req" aria-hidden="true" /> Requests, <span className="ops-key ops-key-err" aria-hidden="true" /> errors (5xx), one bar an hour, days in Pacific time. {requests.toLocaleString("en-US")} requests and {errors.toLocaleString("en-US")} errors in seven days.
      </figcaption>
    </figure>
  );
}

async function Week() {
  await connection();
  return <WeekChart points={await week()} />;
}

async function Alerts() {
  await connection();
  const a = await alerts();
  const run = a.run;
  return (
    <>
      <ul className="ops-alerts" aria-label="Alert conditions">
        {a.alerts.map((x) => (
          <li key={x.id} className="ops-alert" data-ok={x.ok ? "" : undefined}>
            <span className="ops-alert-dot" aria-hidden="true" />
            <span className="ops-alert-body">
              <span className="ops-alert-name">{x.name}</span>
              <span className="ops-alert-rule muted">{x.rule}</span>
            </span>
            <span className="ops-alert-state tabular">
              <span className="ops-alert-word">{x.ok ? "Green" : "Attention"}</span>
              {x.state}
            </span>
          </li>
        ))}
      </ul>
      <p className="ops-note">
        {run ? (
          <>
            The outside checks last ran {shownAt(run.finishedAt)} {run.source === "render-workflow" ? "on Render Workflows" : "locally, with npm run checks:local"}: {run.passed} of {run.total} passed.
            {run.source === "render-workflow" ? " " : " The hosted nightly run files here again after the next deploy. "}
          </>
        ) : (
          <>No outside check run has been filed on this server yet. </>
        )}
        <Link className="text-link" href="/evidence/operations#nightly">
          Every check, with its result
        </Link>
      </p>
    </>
  );
}

export default function OpsPage() {
  return (
    <div className="page frame ops">
      <header className="page-head">
        <div className="title-row">
          <h1 className="page-title">Operations</h1>
          <Info id="page.ops" />
        </div>
        <p className="lede">How Giftwise is running right now, read live from the tables it already writes. Anyone can see it, and nothing on it is private.</p>
      </header>

      <section className="page-section ops-sec" aria-labelledby="ops-now-h">
        <div className="title-row">
          <h2 id="ops-now-h">Right now</h2>
          <Info id="ops.now" label="" />
        </div>
        <Proves>What this proves: every service is checked live, and the demo stays within its AI budget.</Proves>
        <Suspense fallback={<p className="page-loading">Checking every service…</p>}>
          <RightNow />
        </Suspense>
      </section>

      <section className="page-section ops-sec" aria-labelledby="ops-day-h">
        <div className="title-row">
          <h2 id="ops-day-h">Last 24 hours</h2>
          <Info id="ops.day" label="" />
        </div>
        <Proves>What this proves: requests are answered quickly, each payment and webhook is counted once, and every AI call has a price.</Proves>
        <Suspense fallback={<p className="page-loading">Reading the request log…</p>}>
          <LastDay />
        </Suspense>
      </section>

      <section className="page-section ops-sec" aria-labelledby="ops-stream-h">
        <div className="title-row">
          <h2 id="ops-stream-h">Live stream</h2>
          <Info id="ops.stream" label="" />
        </div>
        <Proves>What this proves: the ledger and the request log record what happens as it happens, with ids shortened and no names or payees.</Proves>
        <Suspense fallback={<p className="page-loading">Opening the stream…</p>}>
          <Stream />
        </Suspense>
      </section>

      <section className="page-section ops-sec" aria-labelledby="ops-week-h">
        <div className="title-row">
          <h2 id="ops-week-h">Reliability over time</h2>
          <Info id="ops.chart" label="" />
        </div>
        <Proves>What this proves: seven days of requests and errors, hour by hour, drawn from the same request log.</Proves>
        <Suspense fallback={<p className="page-loading">Drawing the week…</p>}>
          <Week />
        </Suspense>
      </section>

      <section className="page-section ops-sec" aria-labelledby="ops-trace-h">
        <div className="title-row">
          <h2 id="ops-trace-h">Trace a request</h2>
          <Info id="ops.trace" label="" />
        </div>
        <Proves>What this proves: every API answer carries a request id, and that id leads to the log lines, ledger entries and AI calls it produced.</Proves>
        <TraceBox />
      </section>

      <section className="page-section ops-sec" aria-labelledby="ops-alerts-h">
        <div className="title-row">
          <h2 id="ops-alerts-h">Alerts</h2>
          <Info id="ops.alerts" label="" />
        </div>
        <Proves>What this proves: the conditions a pager would watch are computed live from the same tables, so a problem shows here first.</Proves>
        <Suspense fallback={<p className="page-loading">Checking each condition…</p>}>
          <Alerts />
        </Suspense>
      </section>

      <p className="ops-foot muted">Nothing on this page is private: no names, payees, photos, keys or addresses.</p>
    </div>
  );
}
