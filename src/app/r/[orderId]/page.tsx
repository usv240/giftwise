import { asc, eq, inArray, or, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import sources from "../../../../content/sources.json";
import { Info } from "@/components/Info";
import { ReceiptChecks } from "@/components/gift/ReceiptChecks";
import { db, dbConfigured, schema } from "@/lib/db";
import { DEFAULT_PROFILE, RULES, RULES_VERSION, computeMonth, evaluateGift, monthOf, sourcesFor, usd, type Category, type Delivery, type Profile } from "@/lib/rules";
import { asLang, monthIn, payeeIn, payeeInline, receiptText, sampleIn, type Lang } from "@/lib/i18n/gift";
import { ruleSentenceEs } from "@/lib/i18n/gift-rules";
import "../../pages.css";
import "./receipt.css";

export const metadata: Metadata = { title: "Receipt", description: "Where a Giftwise gift went, the rule that kept the SSI check whole, and a live check against PayPal." };

const SRC = sources as Record<string, { title: string; url: string; publisher?: string }>;
const when = (d: Date, lang: Lang = "en") => d.toLocaleString(lang === "es" ? "es-US" : "en-US", { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" });
type Search = { lang?: string };

async function Receipt({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<Search> }) {
  const [{ orderId }, q] = await Promise.all([params, searchParams]);
  const lang = asLang(q.lang);
  const t = receiptText(lang);
  if (!/^[A-Z0-9]{10,24}$/.test(orderId)) notFound();
  if (!dbConfigured()) return <p className="page-loading">The receipt needs its database. See the README to start it.</p>;
  const d = db();
  const rows = await d.select().from(schema.payments).where(eq(schema.payments.orderId, orderId)).orderBy(asc(schema.payments.id));
  if (rows.length === 0) notFound();
  const [household] = rows[0].householdId ? await d.select().from(schema.households).where(eq(schema.households.id, rows[0].householdId)).limit(1) : [];
  const needIds = rows.flatMap((r) => (r.needId ? [r.needId] : []));
  const needs = needIds.length ? await d.select().from(schema.needs).where(inArray(schema.needs.id, needIds)) : [];
  const events = await d
    .select()
    .from(schema.auditEvents)
    .where(or(eq(schema.auditEvents.ref, `order:${orderId}`), sql`${schema.auditEvents.detail}->>'orderId' = ${orderId}`))
    .orderBy(asc(schema.auditEvents.id));

  const name = household?.name ?? "the person";
  const hers = t.possessive(household?.name);
  const profile: Profile = { ...DEFAULT_PROFILE, ...((household?.profile ?? {}) as Partial<Profile>) };
  const date = rows[0].createdAt.toISOString().slice(0, 10);
  const lines = rows.map((r) => {
    const need = needs.find((n) => n.id === r.needId);
    const check = evaluateGift(
      { id: r.referenceId, date, amount: Number(r.amount), delivery: r.route as Delivery, category: (need?.category ?? "other") as Category, recurring: need?.recurring },
      profile,
    );
    // A line with no need is the ABLE savings line; any other line without a need just says where it was paid.
    return { row: r, title: need ? sampleIn(lang, need.title, household?.isSample ?? false) : r.route === "able" ? t.savingsIn(hers) : null, check };
  });
  const captured = rows.every((r) => r.status === "captured");
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const ruleIds = [...new Set(lines.flatMap((l) => l.check.ruleIds))];
  // The whole order counted together, the way Social Security counts a month.
  const trace = computeMonth(
    monthOf(date),
    lines.map((l) => ({ id: l.row.referenceId, date, amount: Number(l.row.amount), delivery: l.row.route as Delivery, category: l.check.gift.category })),
    profile,
  );
  const checkAfter = trace.check;
  const checkMonth = monthIn(lang, trace.paymentMonth);
  const baseline = computeMonth(monthOf(date), [], profile).check;
  const payer = rows.find((r) => r.payerName)?.payerName?.split(" ")[0];

  return (
    <div lang={lang}>
      <header className="page-head">
        <h1 className="page-title">{t.title}</h1>
        <p className="lede">{t.lede}</p>
      </header>
      <section className="rc-summary" data-ui aria-labelledby="rc-total">
        <div>
          <p className="rc-k">{captured ? t.given : t.started}</p>
          <p id="rc-total" className="rc-total tabular">
            {usd(total)}
          </p>
          <p className="rc-sub">{t.sub(payer, rows.length, when(rows[0].createdAt, lang))}</p>
          {/* What happens next, in one sentence, then the reference to quote: the confirmation pattern. */}
          {captured ? (
            <p className="rc-next-line">{t.next(rows.map((r) => payeeInline(lang, r.payeeName)), hers, checkMonth, usd(checkAfter), checkAfter === baseline)}</p>
          ) : (
            rows.every((r) => r.status === "created") && <p className="rc-next-line">{t.nextStarted}</p>
          )}
          <p className="rc-order tabular">{t.orderLine(orderId)}</p>
        </div>
        <dl className="rc-facts">
          <div>
            <dt>{t.countedAs(hers)}</dt>
            <dd className="tabular">$0</dd>
          </div>
          <div>
            <dt>{t.checkAfter(hers, checkMonth)}</dt>
            <dd className="tabular" data-kept="">
              {usd(checkAfter)}
            </dd>
          </div>
          <div>
            <dt>{t.sentTo(hers)}</dt>
            <dd className="tabular">$0</dd>
          </div>
        </dl>
      </section>

      <section className="page-section" aria-labelledby="rc-where">
        <h2 id="rc-where">{t.where}</h2>
        <ul className="rc-lines">
          {lines.map(({ row, title }) => (
            <li key={row.id} className="rc-line">
              <div>
                <p className="rc-payee">{payeeIn(lang, row.payeeName)}</p>
                <p className="rc-for">
                  {title ? `${title}. ` : ""}
                  {row.route === "able" ? t.routeAble : row.route === "vendor" ? t.routeVendor : row.route}.
                </p>
                <p className="rc-ids tabular">
                  {row.captureId ? t.capture(row.captureId) : t.order(row.orderId, row.status)}
                </p>
              </div>
              <p className="rc-amount tabular">{usd(Number(row.amount))}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="page-section" aria-labelledby="rc-why">
        <h2 id="rc-why">{t.why(hers)}</h2>
        {lang === "es" && (
          <ul className="rc-rules">
            {lines.map(({ row, check }) => (
              <li key={row.id}>
                <p className="rc-rule-name">{payeeIn(lang, row.payeeName)}</p>
                <p>{ruleSentenceEs(check, profile.couple)}</p>
              </li>
            ))}
          </ul>
        )}
        <ul className="rc-rules" hidden={lang === "es"}>
          {ruleIds.map((id) => {
            const rule = RULES[id];
            if (!rule) return null;
            return (
              <li key={id}>
                <p className="rc-rule-name">
                  {rule.name} <span className="muted">({id})</span>
                </p>
                <p>{rule.plain}</p>
              </li>
            );
          })}
        </ul>
        <p className="rc-sources-k">{t.sources}</p>
        <ul className="rc-sources">
          {sourcesFor(ruleIds).map((k) => (
            <li key={k}>
              <a className="text-link" href={SRC[k]?.url} target="_blank" rel="noreferrer">
                {SRC[k]?.title ?? k}
              </a>
            </li>
          ))}
        </ul>
        <p className="rc-version muted">{t.version(RULES_VERSION)}</p>
      </section>

      <section className="page-section" aria-labelledby="rc-check">
        <div className="title-row">
          <h2 id="rc-check">{t.checkIt}</h2>
          <Info id="gift.receipt" label="" topic={t.checkIt} lang={lang} />
        </div>
        <ReceiptChecks orderId={orderId} lang={lang} />
        <ol className="rc-events">
          {events.map((e) => (
            <li key={e.id}>
              <span>
                {t.events[e.action] ?? e.action}
                {e.actor === "agent" ? t.byAgent : ""}
              </span>
              <span className="muted">{when(e.at, lang)}</span>
              <span className="rc-hash tabular" title={e.hash}>
                {e.hash.slice(0, 16)}
              </span>
            </li>
          ))}
        </ol>
        <p className="rc-hash-note muted">{t.hashNote}</p>
      </section>

      {household && (
        <p className="page-section rc-next">
          <Link className="text-link" href={lang === "es" ? `/g/${household.slug}/report/easy?month=${monthOf(date)}&lang=es` : `/g/${household.slug}/report?month=${monthOf(date)}`}>
            {t.onReport(hers, monthIn(lang, monthOf(date)))}
          </Link>
          <Link className="text-link" href={`/g/${household.slug}${lang === "es" ? "?lang=es" : ""}`}>
            {t.back(name)}
          </Link>
        </p>
      )}
    </div>
  );
}

// The order id and language are runtime data, so the whole receipt, header included, is read inside Suspense.
export default function Page({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<Search> }) {
  return (
    <div className="page frame receipt">
      <Suspense fallback={<p className="page-loading">Loading the receipt…</p>}>
        <Receipt params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
