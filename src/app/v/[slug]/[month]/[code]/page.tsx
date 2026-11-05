import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Info } from "@/components/Info";
import { connection } from "next/server";
import { today } from "@/lib/api/envelope";
import { verifyReport, type LineCheck } from "@/lib/report/verify";
import { usd } from "@/lib/rules";
import "../../../../pages.css";
import "../../../../developers/dev.css";
import "./verify.css";

export const metadata: Metadata = {
  title: "Check a report",
  description: "Giftwise rebuilds a month's report to Social Security from its records, asks PayPal for every payment in it, and checks the audit ledger.",
  robots: { index: false },
};

type Params = { slug: string; month: string; code: string };

const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function PayPalCell({ c }: { c: LineCheck }) {
  const ev = c.line.evidence;
  if (ev.kind === "sample") return <span className="muted">Sample year, no PayPal record</span>;
  if (!c.paypal.asked) return <span className="muted">PayPal not connected here</span>;
  const id = ev.kind === "paypal_capture" ? ev.captureId : ev.transactionId;
  return (
    <span className="vf-pp">
      <span className="vf-badge" data-ok={c.ok ? "" : undefined}>
        {c.paypal.status ?? "Not found"}
      </span>
      <span className="tabular vf-id">{id}</span>
      {c.paypal.amount !== null && <span className="tabular">{usd(c.paypal.amount)}</span>}
      {c.paypal.ref && <span className="muted vf-payee">to {c.paypal.ref}</span>}
    </span>
  );
}

async function Check({ params }: { params: Promise<Params> }) {
  // A check is made now, against PayPal and the ledger as they are: always at request time.
  await connection();
  const { slug, month, code } = await params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !/^[0-9A-Za-z]{5}-[0-9A-Za-z]{5}$/.test(code)) notFound();
  const v = await verifyReport(slug, month, code, today());
  if (!v) notFound();
  const r = v.report;
  const head =
    v.verdict === "matches"
      ? `This report matches ${v.name}'s records and PayPal's.`
      : v.verdict === "changed"
        ? `${v.name}'s ${v.monthLabel} has new activity since this report was made.`
        : `This report matches ${v.name}'s records. PayPal's side is shown line by line below.`;
  return (
    <>
      <section className="vf-verdict" data-state={v.verdict} aria-labelledby="vf-h">
        <p className="vf-k">
          Report code <span className="tabular">{v.code}</span>, {v.name}, {v.monthLabel}
        </p>
        <h2 id="vf-h" className="vf-head">
          {head}
        </h2>
        {v.verdict === "changed" && (
          <p className="vf-sub">
            The report below is the current one, code <span className="tabular">{v.currentCode}</span>. A report printed earlier in the month lists the gifts up to that day.
          </p>
        )}
        <ul className="vf-checks">
          <li data-ok={v.codeMatches ? "" : undefined}>
            <span className="vf-check-k">Rebuilt from Giftwise&rsquo;s records</span>
            <span>{v.codeMatches ? "Same gifts, routes, rules and check as the report" : `Now code ${v.currentCode}`}</span>
          </li>
          <li data-ok={v.paypal.asked === v.paypal.confirmed ? "" : undefined}>
            <span className="vf-check-k">Asked PayPal just now</span>
            <span>
              {v.paypal.asked
                ? `${v.paypal.confirmed} of ${v.paypal.asked} ${v.paypal.asked === 1 ? "payment" : "payments"} completed, each for the amount and to the account named`
                : `No PayPal payments this month${v.samples ? `: the ${v.samples} gifts are the sample year's` : ""}`}
            </span>
          </li>
          <li data-ok={v.ledger.ok ? "" : undefined}>
            <span className="vf-check-k">Audit ledger</span>
            <span>{v.ledger.ok ? `${v.ledger.count.toLocaleString("en-US")} entries, every fingerprint matches the one before it` : `The chain stops matching at entry ${v.ledger.brokenAt}`}</span>
          </li>
        </ul>
      </section>

      <section className="page-section" aria-labelledby="vf-lines-h">
        <h2 id="vf-lines-h">
          Every gift in {r.monthLabel}: {r.status === "nothing_counts" ? "none of it counts as income" : r.headline}
        </h2>
        <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="Each gift and what PayPal says about it">
          <table className="doc-table vf-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Gift</th>
                <th scope="col">Paid to</th>
                <th scope="col">PayPal, asked just now</th>
                <th scope="col">Ledger</th>
              </tr>
            </thead>
            <tbody>
              {v.lines.map((c) => (
                <tr key={c.line.id}>
                  <td className="tabular vf-nowrap">{day(c.line.date)}</td>
                  <td>
                    <span className="tabular">{usd(c.line.amount)}</span> <span className="muted">{c.line.need}</span>
                  </td>
                  <td>{c.line.paidTo}</td>
                  <td>
                    <PayPalCell c={c} />
                  </td>
                  <td className="tabular">{c.ledger ? <span title={c.ledger.hash}>#{c.ledger.id}</span> : <span className="muted">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="page-prose vf-total">
          {r.monthLabel}: <span className="tabular">{usd(r.totals.given)}</span> given, <span className="tabular">{usd(r.totals.counted)}</span> counted as income. The {r.totals.checkMonthLabel} check it decides:{" "}
          <span className="tabular">{usd(r.totals.check)}</span>.
        </p>
      </section>

      <section className="page-section" aria-labelledby="vf-what-h">
        <h2 id="vf-what-h">What this check shows</h2>
        <p className="page-prose">
          Every gift on the report went to the shop or the ABLE account named, through PayPal, and none of it went to {v.name}&rsquo;s bank or to Giftwise. Each payment above was read from PayPal at{" "}
          {new Date(v.checkedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}, and each capture was written to an append-only ledger whose every entry carries the
          fingerprint of the one before it, so an edited entry would stop matching.
        </p>
        <p className="page-prose">
          <Link className="text-link" href={`/g/${v.slug}/report?month=${v.month}`}>
            Open the report itself
          </Link>
          {" · "}
          <Link className="text-link" href="/learn#timing">
            Why a month&rsquo;s gifts change a later check
          </Link>
        </p>
        <p className="muted tech-only">
          src/lib/report/verify.ts: the code is the first 50 bits of SHA-256 over the report&rsquo;s facts (each line&rsquo;s date, amount, route, recipient, treatment, rules and PayPal record, and the check),
          in Crockford base 32. PayPal: GET /v2/checkout/orders/&#123;id&#125; per order and GET /v1/payments/payouts/&#123;batch&#125; per batch; the payee email is compared with the one Giftwise sent
          when it created the order. Ledger: verifyChain() over every entry.
        </p>
      </section>
    </>
  );
}

export default function Page({ params }: { params: Promise<Params> }) {
  return (
    <div className="page frame verify">
      <header className="page-head">
        <div className="title-row">
          <h1 className="page-title">Check a report</h1>
          <Info id="page.verify" />
        </div>
        <p className="lede">Anyone with a report&rsquo;s code can check it here: a benefits counselor, a caseworker, or the person it belongs to. No login, and nothing beyond what the report shows.</p>
      </header>
      <Suspense fallback={<p className="page-loading">Asking PayPal and checking the ledger…</p>}>
        <Check params={params} />
      </Suspense>
    </div>
  );
}
