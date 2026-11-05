import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Info } from "@/components/Info";
import { CalendarLoader } from "@/components/calendar/CalendarLoader";
import { today } from "@/lib/api/envelope";
import { giftSubject } from "@/lib/report/data";
import { currentReportMonth } from "@/lib/report/ssa";
import { monthOf, pronounWords } from "@/lib/rules";
import "../../../pages.css";
import "./calendar.css";

export const metadata: Metadata = {
  title: "Benefit calendar",
  description: "Every gift on the day it arrived, each report to Social Security on its due date, and the check each month pays. Move a gift and the rules run again.",
};

async function CalendarPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ month?: string }> }) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const s = await giftSubject(slug);
  if (!s) notFound();
  const w = pronounWords(s.profile.pronoun);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(q.month ?? "") ? q.month! : currentReportMonth(today(), [...new Set(s.gifts.map((g) => monthOf(g.date)))]);
  const gifts = s.gifts.map((g) => ({ id: g.id, date: g.date, amount: g.amount, delivery: g.delivery, category: g.category, giver: g.giver, need: g.need, paidTo: g.paidTo, recurring: g.recurring }));
  return (
    <>
      <header className="page-head">
        <div className="title-row">
          <h1 className="page-title">{s.name}&rsquo;s benefit calendar</h1>
          <Info id="page.calendar" />
        </div>
        <p className="lede">
          SSI runs on the calendar. Income in one month sets the check two months later, the report is due by the 10th, and the $60 exclusion for one-time gifts resets each quarter. Here is{" "}
          {w.poss} year, day by day.
        </p>
        <p className="bc-links">
          <Link className="text-link" href={`/g/${slug}`}>
            Back to {s.name}&rsquo;s gift page
          </Link>
          <Link className="text-link" href={`/g/${slug}/report`}>
            {s.name}&rsquo;s report to Social Security
          </Link>
        </p>
      </header>
      <section className="page-section bc-section" aria-label={`${s.name}'s benefit calendar`}>
        <CalendarLoader gifts={gifts} profile={s.profile} name={s.name} month={month} poss={w.Poss} />
      </section>
    </>
  );
}

export default function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ month?: string }> }) {
  return (
    <div className="page frame">
      <Suspense fallback={<p className="page-loading">Loading the calendar&hellip;</p>}>
        <CalendarPage params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
