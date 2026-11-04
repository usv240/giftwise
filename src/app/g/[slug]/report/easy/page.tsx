import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Info } from "@/components/Info";
import { EasyPicture } from "@/components/report/EasyPicture";
import { CopyScript, PrintButton } from "@/components/report/ReportActions";
import { today } from "@/lib/api/envelope";
import { giftSubject } from "@/lib/report/data";
import { easyRead, type EasyLang, type EasyLine } from "@/lib/report/easy";
import { buildReport, currentReportMonth } from "@/lib/report/ssa";
import { monthOf } from "@/lib/rules";
import "../../../../pages.css";
import "../report.css";
import "./easy.css";

export const metadata: Metadata = {
  title: "Easy Read report",
  description: "The month's gifts and what to tell Social Security, in Easy Read, in English or Spanish, for the person who receives SSI.",
};

type Search = { month?: string; lang?: string; view?: string };

function Line({ l }: { l: EasyLine }) {
  return (
    <li className="er-line" data-pic={l.picture ? "" : undefined}>
      <span className="er-pic-cell">{l.picture && <EasyPicture name={l.picture} />}</span>
      <span className="er-words">
        <span className="er-text">{l.text}</span>
        {l.note && <span className="er-note">{l.note}</span>}
      </span>
    </li>
  );
}

async function Easy({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Search> }) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const subject = await giftSubject(slug);
  if (!subject) notFound();
  const lang: EasyLang = q.lang === "es" ? "es" : "en";
  const view = q.view === "cash" ? "cash" : "given";
  const now = today();
  const months = [...new Set(subject.gifts.map((g) => monthOf(g.date)))].sort();
  const month = q.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(q.month) ? q.month : currentReportMonth(now, months);
  const r = buildReport({ name: subject.name, profile: subject.profile, gifts: subject.gifts, month, today: now, view });
  const e = easyRead(r, lang);
  const qs = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ month, view: view === "cash" ? "cash" : undefined, ...o }).filter((x): x is [string, string] => Boolean(x[1])));
    return `?${p.toString()}`;
  };

  return (
    <div lang={lang}>
      <header className="page-head rp-head">
        <div className="title-row">
          <h1 className="page-title">{e.ui.heading}</h1>
          <Info id="page.report.easy" />
        </div>
        <p className="lede">{e.ui.lede}</p>
      </header>
      <nav className="rp-bar er-bar" aria-label={e.ui.nav}>
        <Link className="btn btn-quiet" href={`/g/${slug}/report/easy${qs({ lang: lang === "en" ? "es" : undefined })}`} hrefLang={lang === "en" ? "es" : "en"}>
          {e.ui.other}
        </Link>
        <a className="btn btn-quiet" href={`/g/${slug}/report/reminder${qs({ lang: lang === "es" ? "es" : undefined })}`} download>
          {e.ui.remind}
        </a>
        <PrintButton label={e.ui.print} />
        <Link className="btn btn-quiet" href={`/g/${slug}/report?month=${month}${view === "cash" ? "&view=cash" : ""}`}>
          {e.ui.full}
        </Link>
      </nav>

      <article className="er-sheet" aria-labelledby="er-title" data-status={r.status}>
        <header className="er-head">
          <p className="er-label">{e.label}</p>
          <h2 id="er-title" className="er-title">
            {e.title}
          </h2>
        </header>

        {e.whatIf && <p className="rp-whatif er-whatif">{e.whatIf}</p>}
        <ul className="er-answer" aria-label={e.ui.answerLabel}>
          {e.answer.map((l) => (
            <Line key={l.text} l={l} />
          ))}
        </ul>

        {e.sections.map((s) => (
          <section key={s.id} className="er-part" aria-labelledby={`er-${s.id}`}>
            <h3 id={`er-${s.id}`} className="er-part-title">
              {s.title}
            </h3>
            <ul className="er-lines">
              {s.lines.map((l, i) => (
                <Line key={`${s.id}-${i}`} l={l} />
              ))}
            </ul>
          </section>
        ))}

        {e.script.length > 0 && (
          <section className="er-part" aria-labelledby="er-say">
            <h3 id="er-say" className="er-part-title">
              {e.ui.say}
            </h3>
            <ol className="er-script">
              {e.script.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <CopyScript lines={e.script} label={e.ui.copy} copied={e.ui.copied} failed={e.ui.failed} />
          </section>
        )}

        <footer className="er-foot">
          {e.footer.map((f) => (
            <p key={f}>{f}</p>
          ))}
        </footer>
      </article>

      <p className="rp-back">
        <Link className="text-link" href={`/g/${slug}`}>
          {e.ui.back}
        </Link>
      </p>
    </div>
  );
}

export default function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Search> }) {
  return (
    <div className="page frame report easy">
      <Suspense fallback={<p className="page-loading">Writing the report…</p>}>
        <Easy params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
