import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Info } from "@/components/Info";
import { PayMonth, PlanNext } from "@/components/gift/MonthlyActions";
import { today } from "@/lib/api/envelope";
import { monthlyView } from "@/lib/monthly";
import { P, addMonths, checkMonthName, monthName, pronounWords, usd } from "@/lib/rules";
import "../../pages.css";
import "./monthly.css";

export const metadata: Metadata = {
  title: "Your monthly gift",
  description: "The same gift every month, routed again by Social Security's rules for that month's needs, and paid straight to each shop and the ABLE account.",
  robots: { index: false },
};

async function Monthly({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Each visit reads the current month and the gift's live state, so this renders at request time.
  await connection();
  const v = await monthlyView(token, today());
  if (!v) notFound();
  const w = pronounWords(v.household.profile.pronoun);
  const name = v.household.name;
  return (
    <>
      <header className="page-head">
        <h1 className="page-title">Your monthly gift to {name}</h1>
        <p className="lede">
          {usd(v.amount)} every month. Each month the rules route it again for that month&rsquo;s needs, and you approve it in PayPal. It goes straight to each shop and {w.poss} ABLE account.
        </p>
      </header>

      <ol className="mo-months" aria-label="Months, newest first">
        {v.runs.map((r, i) => {
          const prev = v.runs[i + 1];
          return (
            <li key={r.month} className="mo-month" data-paid={r.paid ? "" : undefined}>
              <div className="mo-month-head">
                <h2 className="mo-month-title">{r.label}</h2>
                <span className="mo-status" data-paid={r.paid ? "" : undefined}>
                  {r.paid ? "Paid" : "Ready for you to approve"}
                </span>
              </div>
              <ul className="mo-lines">
                {r.plan.lines.map((l) => (
                  <li key={l.referenceId}>
                    <span>
                      {l.payeeName} <span className="muted">({l.title})</span>
                    </span>
                    <span className="tabular">{usd(l.amount)}</span>
                  </li>
                ))}
              </ul>
              {r.plan.baseline > 0 && (
                <p className="mo-check">
                  {w.Poss} {checkMonthName(addMonths(r.month, P.rmaLagMonths))} check {r.plan.checkWithRouting === r.plan.baseline ? "stays" : "is"} <span className="tabular">{usd(r.plan.checkWithRouting)}</span>. As cash it
                  would be <span className="tabular">{usd(r.plan.checkIfCash)}</span>.
                </p>
              )}
              {r.changes.length > 0 && prev && (
                <div className="mo-changes">
                  <p className="mo-k">What changed since {monthName(prev.month)}</p>
                  <ul>
                    {r.changes.map((c) => (
                      <li key={`${c.kind}-${c.title}`}>
                        <span className="mo-change-what">
                          {c.payee} <span className="muted">({c.title})</span>: <span className="tabular">{usd(c.from)}</span> to <span className="tabular">{usd(c.to)}</span>
                        </span>
                        <span className="mo-change-why">{c.why}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {r.changes.length === 0 && prev && <p className="mo-same muted">The same split as {monthName(prev.month)}.</p>}
              {!r.paid && <PayMonth token={v.token} month={r.month} total={r.plan.lines.reduce((s, l) => s + l.amount, 0)} payees={r.plan.lines.map((l) => l.payeeName)} />}
              {r.paid && r.orderId && (
                <Link className="text-link mo-receipt" href={`/r/${r.orderId}`}>
                  See the receipt
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      {v.status === "active" && (
        <section className="page-section mo-ahead" aria-labelledby="mo-ahead-h">
          <h2 id="mo-ahead-h">The month after</h2>
          <p className="page-prose">Each month is planned when it begins. In this sandbox you can plan {monthName(v.nextMonth)} now and watch the rules route the same gift again.</p>
          <PlanNext token={v.token} label={`Plan ${monthName(v.nextMonth)} now`} />
        </section>
      )}

      <section className="page-section" aria-labelledby="mo-why-h">
        <div className="title-row">
          <h2 id="mo-why-h">Why you approve each month</h2>
          <Info id="monthly.why" label="" topic="Why you approve each month" />
        </div>
        <p className="page-prose">
          A gift that goes straight to each shop has to be approved by you, in PayPal, each time. PayPal can save a payment method for a platform&rsquo;s own account, but not to pay other accounts on
          your behalf, so an automatic charge would mean Giftwise holding your money first. One approval a month keeps it going straight to the people {name} needs to pay.
        </p>
      </section>

      <p className="mo-back">
        <Link className="text-link mo-back-link" href={`/g/${v.household.slug}`}>
          Back to {name}&rsquo;s page
        </Link>
      </p>
    </>
  );
}

export default function Page({ params }: { params: Promise<{ token: string }> }) {
  return (
    <div className="page frame monthly">
      <Suspense fallback={<p className="page-loading">Loading your monthly gift…</p>}>
        <Monthly params={params} />
      </Suspense>
    </div>
  );
}
