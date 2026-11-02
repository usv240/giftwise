import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Info } from "@/components/Info";
import { FamilyDashboard } from "@/components/dashboard/FamilyDashboard";
import { dashboardData } from "@/lib/dashboard/data";
import { usd } from "@/lib/rules";
import "../pages.css";
import "./dashboard.css";

export const metadata: Metadata = { title: "Maya's year", description: "Every gift to the sample household in 2026, how it reached her, and her SSI check with Giftwise compared with cash." };

async function Dashboard() {
  await connection();
  const { gifts, months } = await dashboardData();
  const kept = months.reduce((s, m) => s + m.kept, 0);
  return (
    <>
      <p className="lede">
        Every gift to Maya this year, how it reached her, and what her SSI check would have been as cash. Giftwise kept {usd(kept)} in her checks over {months.length} months.
      </p>
      <p className="muted fd-note">
        A fictional sample year plus every gift paid on this site for Maya. Each check is computed by the rules engine. Built with AG Studio.{" "}
        <Link className="text-link" href="/g/maya">
          Give to Maya
        </Link>
      </p>
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
