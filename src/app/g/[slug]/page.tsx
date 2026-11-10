import type { Metadata } from "next";
import Link from "next/link";
import sources from "../../../../content/sources.json";
import { notFound } from "next/navigation";
import { Info } from "@/components/Info";
import { AbleHandoff } from "@/components/gift/AbleHandoff";
import { GiveAny } from "@/components/gift/GiveAny";
import { DEFAULT_GIFT, suggestedAmounts } from "@/components/gift/amount";
import { routeGift } from "@/lib/routing";
import { NeedCard, type NeedView } from "@/components/gift/NeedCard";
import { ResetSample } from "@/components/gift/ResetSample";
import { ShareGift } from "@/components/gift/ShareGift";
import { RealWorld } from "@/components/RealWorld";
import { SandboxLogin } from "@/components/SandboxLogin";
import { today } from "@/lib/api/envelope";
import { dbConfigured } from "@/lib/db";
import { cache } from "react";
import { cashExample, getHousehold, maskEmail, openNeeds, ownPayee, pageProfile, pageSituation, publicPayee } from "@/lib/households";
import { situationLine } from "@/lib/situation";
import { pageOrigin } from "@/lib/origin";
import { RECORDED_RECEIPT } from "@/lib/sample-receipt";
import QRCode from "qrcode";
import { evaluateGift, fbr, householdSentence, monthOf, pronounWords, usd, type Category, type Delivery, type Profile } from "@/lib/rules";
import { asLang, checkMonthIn, giftText, monthIn, sampleIn } from "@/lib/i18n/gift";
import { householdEs, ruleSentenceEs } from "@/lib/i18n/gift-rules";
import "./gift.css";

type Search = { lang?: string };

/** One read of the household per request, shared by the page's metadata and the page itself. */
const readHousehold = cache(getHousehold);

/**
 * Rules-engine answers that depend only on their inputs (the open needs, the date, her profile and the language), kept
 * per server process so each request reuses them: the giving card's suggested amounts and its starting split, and the
 * rule line on each need. Any change to a need, a payment or the date is a new key.
 */
const ANSWERS = new Map<string, unknown>();
function remember<T>(key: unknown[], compute: () => T): T {
  const k = JSON.stringify(key);
  if (ANSWERS.has(k)) return ANSWERS.get(k) as T;
  const v = compute();
  if (ANSWERS.size >= 1000) ANSWERS.clear();
  ANSWERS.set(k, v);
  return v;
}

/** The share QR code for each address, drawn once per server process: the address is the only input. */
const QR = new Map<string, Promise<string>>();
const qrFor = (url: string) => {
  let svg = QR.get(url);
  if (!svg) {
    svg = QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#21232e", light: "#ffffff" } });
    if (QR.size < 500) QR.set(url, svg);
  }
  return svg;
};

/** IAble's page on Ugift codes: the published pattern for giving to an ABLE account through the plan's own gift page. */
const UGIFT = (sources as Record<string, { url: string }>)["ugift-iable"];

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Search> }): Promise<Metadata> {
  const [{ slug }, q] = await Promise.all([params, searchParams]);
  const lang = asLang(q.lang);
  const data = dbConfigured() ? await readHousehold(slug) : null;
  const name = data?.household.name ?? (lang === "es" ? "alguien" : "someone");
  return {
    title: giftText(lang).help(name),
    description:
      lang === "es"
        ? `Cada regalo de esta página se paga por PayPal directamente a la tienda o a la cuenta ABLE de ${name}, así su cheque de SSI no cambia.`
        : `Every gift on this page is paid through PayPal straight to the shop or to ${name}'s ABLE account, so ${name}'s SSI check stays the same.`,
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
  const data = await readHousehold(slug);
  if (!data) notFound();
  const { household, needs, payments } = data;
  // The same profile the server routes with: this year's ABLE gifts on the page count toward ABLE's yearly limit.
  const profile: Profile = pageProfile(data);
  const w = pronounWords(profile.pronoun);
  const own = (s: string) => sampleIn(lang, s, household.isSample);
  const date = today();
  const cash = remember(["cash", profile, date], () => cashExample(profile, date));
  // Whose facts the check comes from: the organizer's own answers, or the sample situation until they add them.
  const situation = pageSituation(household);
  const fullCheck = cash.checkBaseline >= fbr(profile.couple, cash.paymentMonth);
  const factsLine = situation.kind === "own" ? situationLine(profile, situation.meta?.given, lang) : "";
  // Living in someone else's home without paying her share lowers the check before any gift (R-SHEL-08). The engine
  // says so in every answer; the page says it once, under her check, and each need's rule line keeps to the need.
  const home = cash.trace.household;
  const homeSentence = lang === "es" ? householdEs(home, profile.couple, cash.paymentMonth) : householdSentence(home, profile, cash.paymentMonth);
  const oneRule = (plain: string) => (homeSentence ? plain.replace(` ${homeSentence}`, "") : plain);
  const giftMonth = monthIn(lang, monthOf(today()));
  const shareUrl = `${await pageOrigin()}/g/${slug}${es}`;
  const qrSvg = await qrFor(shareUrl);
  // Payments are newest first, so the first row per need is the latest one.
  const paidByNeed = new Map<number, (typeof payments)[number]>();
  for (const p of payments) if (p.needId && !paidByNeed.has(p.needId)) paidByNeed.set(p.needId, p);
  const views: NeedView[] = needs.map((n) => {
    const gift = { id: `n${n.id}`, date, amount: Number(n.amount), delivery: n.route as Delivery, category: n.category as Category, recurring: n.recurring };
    const r = remember(["need", gift, profile], () => evaluateGift(gift, profile));
    const p = paidByNeed.get(n.id);
    return {
      id: n.id,
      title: own(n.title),
      detail: own(n.detail),
      amount: Number(n.amount),
      funded: Number(n.funded),
      payeeName: n.payeeName,
      payeeAccountShown: ownPayee(n.payeeAccount) ? maskEmail(ownPayee(n.payeeAccount)!) : null,
      route: n.route,
      status: n.status,
      rulePlain: oneRule(lang === "es" ? ruleSentenceEs(r, profile.couple) : r.explanation.plain),
      ruleIds: r.ruleIds,
      checkAfter: r.checkAfter,
      checkMonth: r.paymentMonth,
      checkStays: r.checkAfter === r.checkBaseline,
      payable: r.treatment.kind !== "not_possible",
      paidBy: p?.payerName?.split(" ")[0] ?? null,
      orderId: p?.orderId ?? null,
      captureId: p?.captureId ?? null,
      link: n.link,
    };
  });
  // The giving card's suggested amounts and starting split, from the same inputs it would use in the browser.
  // The browser routes for display only (the server routes again before any order), so an organizer's address stays here.
  const give = openNeeds(needs).map((n) => ({ ...n, payeeAccount: publicPayee(n.payeeAccount), title: own(n.title) }));
  const ableName = `${household.name}'s ABLE account`;
  const chips = remember(["chips", give, date, profile, ableName, lang], () => suggestedAmounts(give, date, profile, ableName, t.chipAll));
  const firstPlan = remember(["plan", give, date, profile, ableName], () => routeGift(DEFAULT_GIFT, give, date, profile, ableName));
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
        <p className="gift-sample muted">{household.isSample ? t.sampleNote : t.madeNote(situation.kind === "own")}</p>
        <p className="gift-sample muted gift-able-real">
          {t.ableReal(w)}{" "}
          <a className="text-link" href={UGIFT.url} target="_blank" rel="noreferrer">
            {t.ableRealSource}
          </a>
        </p>
        {household.status === "closed" && (
          <p className="gift-closed" role="status">
            {t.closed(household.name)}
          </p>
        )}
      </header>
      {household.status !== "closed" && (
        <div className="gift-give">
          <GiveAny slug={slug} name={household.name} needs={give} date={date} profile={profile} lang={lang} chips={chips} firstPlan={firstPlan} />
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
          {/* Her check comes from her own facts, or from the sample situation until the organizer adds them. */}
          {situation.kind !== "sample_page" && (
            <p className="gift-situation" data-own={situation.kind === "own" ? "" : undefined}>
              {situation.kind === "own"
                ? t.situationOwn(lang === "es" ? `su situación${factsLine ? `: ${factsLine}` : ", como la indicó quien organiza"}` : `${household.name}'s own situation${factsLine ? `: ${factsLine}` : ", as the organizer gave it"}`)
                : t.situationSample(w)}{" "}
              <Info id="gift.situation" label="" topic={lang === "es" ? "Su situación" : `${household.name}'s situation`} lang={lang} />
            </p>
          )}
          {homeSentence && <p className="gift-situation gift-home">{homeSentence}</p>}
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
            {household.isSample && (
              <Link className="text-link gift-latest gift-sample-receipt" href={`/r/${RECORDED_RECEIPT.order_id}${es}`}>
                {t.sampleReceipt}
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
            {t.cashText(w, usd(cash.checkAfter), usd(cash.checkBaseline), checkMonthIn(lang, cash.paymentMonth), fullCheck)}{" "}
            <Link className="text-link" href="/try">
              {t.checkAny}
            </Link>
          </p>
        </details>
        {/* The demo's own controls, one press away and marked Sandbox, apart from the giver's path: the buyer login and
            test card, the sample organizer's private link, and the reset. */}
        <details className="gift-cash gift-sandbox">
          <summary>
            <span className="sbx-tag">Sandbox</span>
            <span className="sbx-what">{t.sandboxHolds(household.isSample)}</span>
          </summary>
          <div className="title-row">
            <p>{t.sandboxText}</p>
            <Info id="gift.sandbox" label="" topic={t.sandboxTitle} lang={lang} />
          </div>
          <SandboxLogin compact lang={lang} />
          <p>{t.sandboxCard}</p>
          {household.isSample && (
            <p>
              <Link className="text-link gift-organizer" href="/manage/maya-sample-organizer">
                {t.organizerView}
              </Link>
            </p>
          )}
          {household.isSample && <ResetSample slug={slug} lang={lang} />}
        </details>
      </aside>
      <div className="gift-real" lang="en">
        <div lang={lang}>
          <AbleHandoff name={household.name} poss={w.poss} lang={lang} />
        </div>
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

/**
 * The gift page renders on the server before it is sent, so the first paint already shows who it is for, the needs
 * and the way to give, with no loading step; the PayPal buttons and the giving card hydrate on top of that HTML.
 * Measured on one machine, a blocking render finishes sooner than the streamed one (about 65 ms against 115 ms for a
 * single request), because the page is one indexed read and a few rules-engine calls.
 */
export const instant = false;

export default function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Search> }) {
  return (
    <div className="gift frame">
      <GiftPage params={params} searchParams={searchParams} />
    </div>
  );
}
