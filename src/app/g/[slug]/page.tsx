import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Info } from "@/components/Info";
import { GiveAny } from "@/components/gift/GiveAny";
import { NeedCard, type NeedView } from "@/components/gift/NeedCard";
import { ResetSample } from "@/components/gift/ResetSample";
import { ShareGift } from "@/components/gift/ShareGift";
import { RealWorld } from "@/components/RealWorld";
import { SandboxLogin } from "@/components/SandboxLogin";
import { today } from "@/lib/api/envelope";
import { dbConfigured } from "@/lib/db";
import { getHousehold, openNeeds } from "@/lib/households";
import { pageOrigin } from "@/lib/origin";
import QRCode from "qrcode";
import { DEFAULT_PROFILE, evaluateGift, monthOf, pronounWords, usd, type Category, type Delivery, type Profile } from "@/lib/rules";
import { asLang, giftText, monthIn, sampleIn } from "@/lib/i18n/gift";
import { ruleSentenceEs } from "@/lib/i18n/gift-rules";
import "./gift.css";

type Search = { lang?: string };

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Search> }): Promise<Metadata> {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const lang = asLang(q.lang);
  const data = dbConfigured() ? await getHousehold(slug) : null;
  const name = data?.household.name ?? (lang === "es" ? "alguien" : "someone");
  return {
    title: giftText(lang).help(name),
    description:
      lang === "es"
        ? `Cada regalo de esta página se paga directamente a la tienda por PayPal, así el cheque de SSI de ${name} no cambia.`
        : `Every gift on this page is paid straight to the shop through PayPal, so ${name}'s SSI check stays the same.`,
    robots: data && !data.household.isSample ? { index: false } : undefined,
  };
}

async function GiftPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Search> }) {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const lang = asLang(q.lang);
  const t = giftText(lang);
  const es = lang === "es" ? "?lang=es" : "";
  if (!dbConfigured()) {
    return <p className="gift-empty">The sample page needs its database. See the README to start it.</p>;
  }
  const data = await getHousehold(slug);
  if (!data) notFound();
  const { household, needs, payments } = data;
  const profile: Profile = { ...DEFAULT_PROFILE, ...(household.profile as Partial<Profile>) };
  const w = pronounWords(profile.pronoun);
  const own = (s: string) => sampleIn(lang, s, household.isSample);
  const cash = evaluateGift({ id: "cash", date: today(), amount: 300, delivery: "cash", category: "other" }, profile);
  const giftMonth = monthIn(lang, monthOf(today()));
  const shareUrl = `${await pageOrigin()}/g/${slug}${es}`;
  const qrSvg = await QRCode.toString(shareUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#21232e", light: "#ffffff" } });
  // Payments are newest first, so the first row per need is the latest one.
  const paidByNeed = new Map<number, (typeof payments)[number]>();
  for (const p of payments) if (p.needId && !paidByNeed.has(p.needId)) paidByNeed.set(p.needId, p);
  const views: NeedView[] = needs.map((n) => {
    const r = evaluateGift(
      { id: `n${n.id}`, date: today(), amount: Number(n.amount), delivery: n.route as Delivery, category: n.category as Category, recurring: n.recurring },
      profile,
    );
    const p = paidByNeed.get(n.id);
    return {
      id: n.id,
      title: own(n.title),
      detail: own(n.detail),
      amount: Number(n.amount),
      funded: Number(n.funded),
      payeeName: n.payeeName,
      route: n.route,
      status: n.status,
      rulePlain: lang === "es" ? ruleSentenceEs(r, profile.couple) : r.explanation.plain,
      ruleIds: r.ruleIds,
      checkAfter: r.checkAfter,
      checkMonth: r.paymentMonth,
      checkStays: r.checkAfter === r.checkBaseline,
      paidBy: p?.payerName?.split(" ")[0] ?? null,
      orderId: p?.orderId ?? null,
      captureId: p?.captureId ?? null,
      link: n.link,
    };
  });
  const open = views.filter((v) => v.status !== "paid");
  const paidTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
  const openTotal = open.reduce((s, v) => s + Math.max(0, v.amount - v.funded), 0);
  const saved = payments.filter((p) => p.route === "able" && !p.needId).reduce((s, p) => s + Number(p.amount), 0);
  const latest = payments[0]?.orderId ?? null;

  return (
    // Reading order is the phone order: the header, give, the needs, her month and the sandbox, then the questions about
    // real money. On a wide screen the grid sets give and her month in the right-hand column, beside the header, so the
    // whole way to give, PayPal button included, is on the first screen.
    <div className="gift-layout" lang={lang} data-closed={household.status === "closed" ? "" : undefined}>
      <header className="gift-head">
        {/* The language switch has its own place at the end of the title row, named in its own language. */}
        <div className="gift-title-row">
          <h1 className="gift-title">{t.help(household.name)}</h1>
          <Link className="gift-lang" href={`/g/${slug}${t.langSwitch.lang === "es" ? "?lang=es" : ""}`} hrefLang={t.langSwitch.lang} lang={t.langSwitch.lang}>
            {t.langSwitch.label}
          </Link>
        </div>
        <p className="gift-note">{own(household.note)}</p>
        <p className="gift-sample muted">{household.isSample ? t.sampleNote : t.madeNote}</p>
        {household.isSample && lang === "en" && (
          <p className="gift-sample">
            <Link className="text-link gift-organizer" href="/manage/maya-sample-organizer">
              See the organizer&rsquo;s view of this page
            </Link>
          </p>
        )}
        {household.status === "closed" && (
          <p className="gift-closed" role="status">
            {t.closed(household.name)}
          </p>
        )}
      </header>
      {household.status !== "closed" && (
        <div className="gift-give">
          <GiveAny slug={slug} name={household.name} needs={openNeeds(needs).map((n) => ({ ...n, title: own(n.title) }))} date={today()} profile={profile} lang={lang} />
        </div>
      )}
      <div className="gift-needs">
        <h2 className="gift-h2">{t.needsH(household.name)}</h2>
        <div className="gift-list">
          {views.map((v) => (
            <NeedCard key={v.id} need={v} pronoun={profile.pronoun} lang={lang} closed={household.status === "closed"} />
          ))}
        </div>
      </div>
      <aside className="gift-aside" aria-labelledby="month-h">
        <div className="gift-month" data-ui>
          <h2 id="month-h" className="gift-month-title">
            {t.monthH(household.name)}
          </h2>
          <p className="gift-k">
            {t.checkMonth(monthIn(lang, cash.paymentMonth), cash.paymentMonth.slice(0, 4), giftMonth)}
          </p>
          <p className="gift-check tabular">{usd(cash.checkBaseline)}</p>
          <dl className="gift-facts">
            <div>
              <dt>{t.givenSoFar}</dt>
              <dd className="tabular">{usd(paidTotal)}</dd>
            </div>
            <div>
              <dt>{t.stillNeeded}</dt>
              <dd className="tabular">{usd(openTotal)}</dd>
            </div>
            {saved > 0 && (
              <div>
                <dt>{t.savedAble(w)}</dt>
                <dd className="tabular">{usd(saved)}</dd>
              </div>
            )}
            <div>
              <dt>{t.counted}</dt>
              <dd className="tabular">$0</dd>
            </div>
          </dl>
          {/* Her reports and calendar: the links wrap side by side, so two short ones share a line. */}
          <div className="gift-links">
            {latest && (
              <Link className="text-link gift-latest" href={`/r/${latest}${es}`}>
                {t.latestReceipt}
              </Link>
            )}
            {lang === "es" && (
              <Link className="text-link gift-latest" href={`/g/${slug}/report/easy?lang=es`}>
                {t.easyLink(household.name)}
              </Link>
            )}
            <Link className="text-link gift-latest" href={`/g/${slug}/report`}>
              {t.reportLink(household.name)}
            </Link>
            {lang === "en" && (
              <Link className="text-link gift-latest" href={`/g/${slug}/report/easy`}>
                {t.easyLink(household.name)}
              </Link>
            )}
            <Link className="text-link gift-latest" href={`/g/${slug}/calendar`}>
              {t.calendarLink(household.name)}
            </Link>
            {household.isSample && (
              <Link className="text-link gift-latest" href="/dashboard">
                {t.yearLink(household.name)}
              </Link>
            )}
          </div>
        </div>
        <ShareGift url={shareUrl} title={t.help(household.name)} text={t.shareMessage(household.name, w)} qrSvg={qrSvg} lang={lang} />
        <details className="gift-cash">
          <summary>{t.cashQ}</summary>
          <p>
            {t.cashText(w, usd(cash.checkAfter), usd(cash.checkBaseline))}{" "}
            <Link className="text-link" href="/try">
              {t.checkAny}
            </Link>
          </p>
        </details>
        <div className="gift-sandbox">
          <div className="title-row">
            <p className="gift-sandbox-title">{t.sandboxTitle}</p>
            <Info id="gift.sandbox" label="" topic={t.sandboxTitle} lang={lang} />
          </div>
          <p>{t.sandboxText}</p>
          <SandboxLogin compact lang={lang} />
          {household.isSample && <ResetSample slug={slug} lang={lang} />}
        </div>
      </aside>
      <div className="gift-real" lang="en">
        {lang === "es" && (
          <p className="gift-real-note muted" lang="es">
            {t.realWorldNote}
          </p>
        )}
        <RealWorld />
      </div>
    </div>
  );
}

// The slug is runtime data, so the whole page, header included, is read inside Suspense.
export default function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Search> }) {
  return (
    <div className="gift frame">
      <Suspense fallback={<p className="gift-empty page-loading">Loading the gift page…</p>}>
        <GiftPage params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
