import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Info } from "@/components/Info";
import { Checklist, CopyScript, PrintButton } from "@/components/report/ReportActions";
import { today } from "@/lib/api/envelope";
import { ZONE_NAME, shownDay } from "@/lib/time";
import { giftSubject } from "@/lib/report/data";
import { reportCode, verifyPath } from "@/lib/report/verify";
import { pageOrigin } from "@/lib/origin";
import QRCode from "qrcode";
import { buildReport, currentReportMonth, type Evidence, type ReportLine, type SsaReport } from "@/lib/report/ssa";
import { checkMonthName, monthName, monthOf, pronounWords, usd } from "@/lib/rules";
import "../../../pages.css";
import "./report.css";

export const metadata: Metadata = {
  title: "Report to Social Security",
  description: "One month of gifts, written up the way SSI reporting asks: what to tell Social Security by the 10th, and the PayPal record behind every gift that is not income.",
};

type Search = { month?: string; view?: string };
// Each gift's income date, already a Pacific-time day (src/lib/time.ts), the same day its receipt shows.
const short = (iso: string) => shownDay(iso);
/** "POMS SI 00815.400: Bills Paid by Third Party" -> "POMS SI 00815.400"; "SSA: Spotlight on ABLE accounts" -> "Spotlight on ABLE accounts". */
const sourceLabel = (title: string) => (title.startsWith("SSA: ") ? title.slice(5).replace(/ \(\d{4} edition\)$/, "") : title.split(":")[0]);

function dueText(r: SsaReport) {
  const d = r.due;
  if (d.state === "in_progress") return `${monthName(r.month)} is still going. Due ${d.label}.`;
  if (d.state === "past") return `Was due ${d.label}.`;
  if (d.daysLeft === 0) return `Due today, ${d.label}.`;
  return `Due ${d.label}, ${d.daysLeft === 1 ? "1 day" : `${d.daysLeft} days`} from today.`;
}

function EvidenceCell({ e }: { e: Evidence }) {
  if (e.kind === "paypal_capture") {
    return (
      <Link className="text-link tabular" href={`/r/${e.orderId}`}>
        PayPal capture {e.captureId ?? e.orderId}
      </Link>
    );
  }
  if (e.kind === "paypal_payout") return <span className="tabular">PayPal Payouts {e.transactionId ?? e.batchId}</span>;
  return <span className="muted">Sample year, no PayPal record</span>;
}

function Rule({ l }: { l: ReportLine }) {
  return (
    <>
      {l.why}{" "}
      {l.sources.slice(0, 2).map((s, i) => (
        <span key={s.id}>
          {i > 0 ? "; " : ""}
          <a className="text-link" href={s.url} target="_blank" rel="noreferrer">
            {sourceLabel(s.title)}
          </a>
        </span>
      ))}
      <span className="tech-only rp-tech">{l.ruleIds.join(", ")}</span>
      {l.flag && <span className="rp-flag">{l.flag}</span>}
    </>
  );
}

async function Report({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Search> }) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const subject = await giftSubject(slug);
  if (!subject) notFound();
  const now = today();
  const months = [...new Set(subject.gifts.map((g) => monthOf(g.date)))].sort();
  const month = q.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(q.month) ? q.month : currentReportMonth(now, months);
  const view = q.view === "cash" ? "cash" : "given";
  const r = buildReport({ name: subject.name, profile: subject.profile, gifts: subject.gifts, month, today: now, view });
  const w = pronounWords(r.pronoun);
  const tell = r.lines.filter((l) => l.section === "tell");
  const records = r.lines.filter((l) => l.section === "records");
  const at = months.indexOf(month);
  const prev = at > 0 ? months[at - 1] : at === -1 ? months.filter((m) => m < month).at(-1) : undefined;
  const next = at >= 0 && at < months.length - 1 ? months[at + 1] : at === -1 ? months.find((m) => m > month) : undefined;
  const href = (m: string, v = view) => `/g/${slug}/report?month=${m}${v === "cash" ? "&view=cash" : ""}`;
  // The report as given carries its own check: a code, and a QR code for the page that verifies it.
  const code = view === "given" && r.status !== "no_gifts" ? reportCode(slug, r) : null;
  const verifyUrl = code ? `${await pageOrigin()}${verifyPath(slug, r.month, code)}` : null;
  const qr = verifyUrl ? await QRCode.toString(verifyUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#21232e", light: "#ffffff" } }) : null;

  return (
    <>
      {/* Other versions of the same report: plain links under the title, so the bar keeps only the month and the view. */}
      <p className="rp-alt">
        <Link className="text-link" href={`/g/${slug}/report/easy?month=${month}${view === "cash" ? "&view=cash" : ""}`}>
          Easy Read
        </Link>
        <Link className="text-link" href={`/g/${slug}/report/easy?month=${month}&lang=es${view === "cash" ? "&view=cash" : ""}`} hrefLang="es" lang="es">
          En español
        </Link>
      </p>

      <nav className="rp-bar" aria-label="Choose the month and the view">
        <div className="rp-months">
          {prev ? (
            <Link className="btn btn-quiet" href={href(prev)}>
              {monthName(prev)}
            </Link>
          ) : (
            <span className="rp-month-none">No earlier month</span>
          )}
          <p className="rp-month tabular" aria-live="polite">
            {r.monthLabel}
          </p>
          {next ? (
            <Link className="btn btn-quiet" href={href(next)}>
              {monthName(next)}
            </Link>
          ) : (
            <span className="rp-month-none">No later month yet</span>
          )}
        </div>
        <div className="rp-views" role="group" aria-label="Which gifts">
          <Link className="rp-view" href={href(month, "given")} aria-current={view === "given" ? "page" : undefined}>
            As given
          </Link>
          <Link className="rp-view" href={href(month, "cash")} aria-current={view === "cash" ? "page" : undefined}>
            As cash
          </Link>
        </div>
        <div className="rp-actions">
          <a className="text-link rp-csv" href={`/api/v1/ssa-report?page=${slug}&month=${month}${view === "cash" ? "&view=cash" : ""}&format=csv`} download>
            Download CSV
          </a>
          <PrintButton />
        </div>
      </nav>

      <article className="rp-sheet" aria-labelledby="rp-verdict" data-view={view} data-status={r.status}>
        <dl className="rp-meta">
          <div>
            <dt>For</dt>
            <dd>{r.name}</dd>
          </div>
          <div>
            <dt>Income month</dt>
            <dd>{r.monthLabel}</dd>
          </div>
          <div>
            <dt>Report by</dt>
            <dd data-due={r.due.state}>{dueText(r)}</dd>
          </div>
        </dl>

        <section className="rp-verdict" aria-labelledby="rp-verdict">
          {view === "cash" && <p className="rp-whatif">What if every gift had been cash? This is the report {r.name} would have needed.</p>}
          <h2 id="rp-verdict" className="rp-headline">
            {r.headline}
          </h2>
          <p className="rp-summary">{r.summary}</p>
          {r.status !== "no_gifts" && (
            <dl className="rp-figures">
              <div>
                <dt>Given in {monthName(r.month)}</dt>
                <dd className="tabular">{usd(r.totals.given)}</dd>
              </div>
              <div>
                <dt>Counted as {w.poss} income</dt>
                <dd className="tabular">{usd(r.totals.counted)}</dd>
              </div>
              <div>
                <dt>{w.Poss} {checkMonthName(r.totals.checkMonth)} check</dt>
                <dd className="tabular" data-kept={r.totals.check >= r.totals.fullCheck ? "" : undefined}>
                  {usd(r.totals.check)}
                </dd>
              </div>
            </dl>
          )}
          {view === "given" && r.totals.countedIfCash > 0 && (
            <p className="rp-contrast">
              Given as cash, the same {r.totals.gifts === 1 ? "gift" : "gifts"} would count {usd(r.totals.countedIfCash)} and {w.poss} {monthName(r.totals.checkMonth)} check would be {usd(r.totals.checkIfCash)}.{" "}
              <Link className="text-link" href={href(month, "cash")}>
                See that report
              </Link>
            </p>
          )}
          {view === "cash" && (
            <p className="rp-contrast">
              <Link className="text-link" href={href(month, "given")}>
                Back to the gifts as given, where {usd(r.totals.counted)} becomes $0
              </Link>
            </p>
          )}
        </section>

        <section className="rp-part" aria-labelledby="rp-tell">
          <div className="title-row">
            <h3 id="rp-tell">Tell Social Security</h3>
            <Info id="report.tell" label="" />
          </div>
          {tell.length === 0 ? (
            <p className="rp-none">{r.status === "no_gifts" ? "Nothing from Giftwise this month." : `Nothing from these gifts. None of them changes ${w.poss} income.`}</p>
          ) : (
            <ul className="rp-tell">
              {tell.map((l) => (
                <li key={l.id}>
                  <p className="rp-tell-say">{l.say}</p>
                  <p className="rp-tell-why">
                    <Rule l={l} />
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {records.length > 0 && (
          <section className="rp-part" aria-labelledby="rp-records">
            <div className="title-row">
              <h3 id="rp-records">For your records</h3>
              <Info id="report.records" label="" />
            </div>
            <p className="rp-part-lede">Not income. Each was paid by PayPal straight to the shop or {w.poss} ABLE account, so none of it reached {r.name} as money.</p>
            <table className="rp-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">From</th>
                  <th scope="col">For</th>
                  <th scope="col" className="rp-num">
                    Amount
                  </th>
                  <th scope="col">Why it is not income</th>
                  <th scope="col">Proof</th>
                </tr>
              </thead>
              <tbody>
                {records.map((l) => (
                  <tr key={l.id}>
                    <td data-label="Date" className="tabular">
                      {short(l.date)}
                    </td>
                    <td data-label="From">{l.giver}</td>
                    <td data-label="For">
                      <span className="rp-for">{l.need}</span>
                      <span className="rp-to">{l.what}</span>
                    </td>
                    <td data-label="Amount" className="rp-num tabular">
                      {usd(l.amount)}
                    </td>
                    <td data-label="Why" className="rp-why">
                      <Rule l={l} />
                    </td>
                    <td data-label="Proof" className="rp-proof">
                      <EvidenceCell e={l.evidence} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {r.todo.length > 0 && (
          <section className="rp-part" aria-labelledby="rp-todo">
            <h3 id="rp-todo">{r.due.state === "in_progress" ? `Before ${monthName(r.month)} ends` : `To check for ${monthName(r.month)}`}</h3>
            <Checklist storeKey={`giftwise.report.${slug}.${r.month}.${view}`} items={r.todo} />
          </section>
        )}

        <section className="rp-part" aria-labelledby="rp-how">
          <div className="title-row">
            <h3 id="rp-how">How to report</h3>
            <Info id="report.how" label="" />
          </div>
          <p className="rp-phone">
            Call <a className="text-link tabular" href={`tel:${r.how.phone}`}>{r.how.phone}</a>, TTY <a className="text-link tabular" href={`tel:${r.how.tty}`}>{r.how.tty}</a>. {r.how.office} Have {w.poss} Social Security number ready. Giftwise never asks for it.
          </p>
          {r.script.length > 0 ? (
            <div className="rp-script">
              <p className="rp-script-k">What to say</p>
              <ol>
                {r.script.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <CopyScript lines={r.script} />
            </div>
          ) : (
            <p className="rp-none">No call is needed for these gifts. Other changes, like a move or a new job, are reported the same way.</p>
          )}
          <p className="rp-penalty muted">
            Reporting by {r.due.label} keeps {w.poss} check right. A report that is late can mean a deduction of {usd(r.penalty.amounts[0])} the first time, then {usd(r.penalty.amounts[1])}, then {usd(r.penalty.amounts[2])}.
          </p>
        </section>

        {code && verifyUrl && qr && (
          <section className="rp-part rp-verify" aria-labelledby="rp-verify-h">
            <div className="rp-verify-qr" role="img" aria-label="QR code that opens the page checking this report" dangerouslySetInnerHTML={{ __html: qr }} />
            <div>
              <div className="title-row">
                <h3 id="rp-verify-h">Anyone can check this report</h3>
                <Info id="page.verify" label="" />
              </div>
              <p>
                {r.lines.some((l) => l.evidence.kind !== "sample")
                  ? "Scan the code, or open the link, and Giftwise rebuilds this report from its records, asks PayPal for every payment in it, and checks the audit ledger."
                  : "Scan the code, or open the link, and Giftwise rebuilds this report from its records and checks the audit ledger. This month's gifts are from the sample year, which has no PayPal record, so there is nothing to ask PayPal."}{" "}
                A benefits counselor or caseworker can do it without logging in.
              </p>
              <p className="rp-verify-code">
                Report code <span className="tabular">{code}</span>
              </p>
              <Link className="text-link rp-verify-link" href={verifyPath(slug, r.month, code)}>
                {verifyUrl.replace(/^https?:\/\//, "")}
              </Link>
            </div>
          </section>
        )}

        <footer className="rp-part rp-law" aria-labelledby="rp-law">
          <h3 id="rp-law">What the rules say</h3>
          <ul className="rp-quotes">
            {r.passages.map((p) => (
              <li key={p.id}>
                <blockquote cite={p.url}>
                  <p>&ldquo;{p.text}&rdquo;</p>
                </blockquote>
                <a className="text-link rp-cite" href={p.url} target="_blank" rel="noreferrer">
                  {p.cite}
                </a>
              </li>
            ))}
          </ul>
          <p className="rp-scope muted">
            Written by Giftwise from the gifts made through it, with rules version {r.rulesVersion}. Each gift is dated the day PayPal paid it, in {ZONE_NAME}, the day its receipt shows. It covers gifts only. Giftwise does not know about other changes. It is not legal advice, and Giftwise never contacts Social Security for anyone.
          </p>
        </footer>
      </article>

      <p className="rp-back">
        <Link className="text-link" href={`/g/${slug}`}>
          Back to {r.name}&rsquo;s page
        </Link>{" "}
        <Link className="text-link" href={`/g/${slug}/calendar`}>
          See every gift on {r.name}&rsquo;s benefit calendar
        </Link>
        {subject.isSample && (
          <>
            {" "}
            <Link className="text-link" href="/dashboard">
              See {r.name}&rsquo;s year in the dashboard
            </Link>
          </>
        )}
      </p>
    </>
  );
}

// The slug, month and view are runtime data, so everything below the title is read inside Suspense.
export default function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Search> }) {
  return (
    <div className="page frame report">
      <header className="page-head rp-head">
        <div className="title-row">
          <h1 className="page-title">Report to Social Security</h1>
          <Info id="page.report" />
        </div>
        <p className="lede">SSI asks for changes in income by the 10th of the next month. Giftwise writes the report from the gifts themselves, and shows the PayPal record behind every line.</p>
      </header>
      <Suspense fallback={<p className="page-loading">Writing the report…</p>}>
        <Report params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
