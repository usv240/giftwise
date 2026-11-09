import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Info } from "@/components/Info";
import { FamilyDashboard } from "@/components/dashboard/FamilyDashboard";
import { KEPT_VS_CASH, dashboardData, keptAgainstCash, keptSentence } from "@/lib/dashboard/data";
import { ROUTE_LABEL } from "@/lib/dashboard/labels";
import { P, addMonths, fbr, fullCheckByYear, usd, type Delivery } from "@/lib/rules";
import "../pages.css";
import "./dashboard.css";

export const metadata: Metadata = { title: "Maya's year", description: "Every gift to the sample household in 2026, how it reached her, and her SSI check with Giftwise compared with cash." };

async function Dashboard() {
  await connection();
  const { gifts, months } = await dashboardData();
  const kept = keptAgainstCash(months);
  const given = gifts.reduce((s, g) => s + g.amount, 0);
  const checks = months.map((m) => m.checkWithGiftwise);
  const lowest = Math.min(...checks);
  // Each check is paid two months after its gifts, at that year's federal amount, so the full check is named with its year.
  const payMonths = months.map((m) => addMonths(m.month.slice(0, 7), P.rmaLagMonths));
  const checkYears = [...new Set(payMonths.map((m) => m.slice(0, 4)))];
  const fullAll = months.every((m, i) => m.checkWithGiftwise >= fbr(false, payMonths[i]));
  const lowestCash = Math.min(...months.map((m) => m.checkIfCash));
  const routes = (Object.keys(ROUTE_LABEL) as Delivery[])
    .map((d) => ({ d, label: ROUTE_LABEL[d], amount: gifts.filter((g) => g.delivery === d).reduce((s, g) => s + g.amount, 0) }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  return (
    <>
      <p className="lede">
        Every gift to Maya this year, how it reached her, and what her SSI check would have been as cash. {keptSentence(months, usd)}
      </p>
      <p className="muted fd-note">
        A fictional sample year plus every gift paid on this site for Maya. Each check is computed by the rules engine. Built with AG Studio.{" "}
        <Link className="text-link" href="/g/maya">
          Give to Maya
        </Link>
      </p>

      {/* On a phone: the year's totals as a list, and the two pages that show the same gifts in one column. */}
      <section className="fd-phone" aria-labelledby="fd-phone-h">
        <h2 id="fd-phone-h" className="fd-phone-h">
          The year at a glance
        </h2>
        <dl className="fd-list">
          <div>
            <dt>Given this year</dt>
            <dd className="tabular">{usd(given)}</dd>
          </div>
          <div>
            <dt>Kept in her checks, {KEPT_VS_CASH}</dt>
            <dd className="tabular">{usd(kept)}</dd>
          </div>
          <div>
            <dt>Her SSI check with Giftwise</dt>
            <dd className="tabular" data-kept="">
              {fullAll ? (checkYears.length === 1 ? `${usd(lowest)} every month of ${checkYears[0]}` : `Full every month (${fullCheckByYear()})`) : `${usd(lowest)} at the lowest`}
            </dd>
          </div>
          <div>
            <dt>Her lowest check, if every gift had been cash</dt>
            <dd className="tabular">{usd(lowestCash)}</dd>
          </div>
        </dl>
        <h3 className="fd-phone-k">How the money reached her</h3>
        <ul className="fd-routes">
          {routes.map((r) => (
            <li key={r.d}>
              <span className="gw-route gw-routes-dot" data-route={r.d} aria-hidden="true" />
              <span>{r.label}</span>
              <span className="tabular">{usd(r.amount)}</span>
            </li>
          ))}
        </ul>
        <p className="fd-phone-links">
          <Link className="text-link" href="/g/maya/report">
            Her report to Social Security
          </Link>
          <Link className="text-link" href="/g/maya/calendar">
            Her benefit calendar
          </Link>
        </p>
        <p className="muted fd-phone-note">On a laptop or larger, this page shows the full dashboard.</p>
      </section>

      <FamilyDashboard gifts={gifts} months={months} />
    </>
  );
}

export default function DashboardPage() {
  return (
    <div className="page frame dashboard">
      <header className="page-head">
        <div className="title-row">
          <h1 className="page-title">Maya&rsquo;s year</h1>
          <Info id="page.dashboard" />
        </div>
      </header>
      <Suspense fallback={<p className="page-loading">Loading the year…</p>}>
        <Dashboard />
      </Suspense>
    </div>
  );
}
