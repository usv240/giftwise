import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Info } from "@/components/Info";
import { GiveAny } from "@/components/gift/GiveAny";
import { NeedCard, type NeedView } from "@/components/gift/NeedCard";
import { ResetSample } from "@/components/gift/ResetSample";
import { RealWorld } from "@/components/RealWorld";
import { SandboxLogin } from "@/components/SandboxLogin";
import { today } from "@/lib/api/envelope";
import { dbConfigured } from "@/lib/db";
import { getHousehold, openNeeds } from "@/lib/households";
import { DEFAULT_PROFILE, evaluateGift, pronounWords, usd, type Category, type Delivery, type Profile } from "@/lib/rules";
import "./gift.css";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = dbConfigured() ? await getHousehold(slug) : null;
  const name = data?.household.name ?? "someone";
  return {
    title: `Help ${name}`,
    description: `Every gift on this page is paid straight to the shop through PayPal, so ${name}'s SSI check stays the same.`,
    robots: data && !data.household.isSample ? { index: false } : undefined,
  };
}

async function GiftPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!dbConfigured()) {
    return <p className="gift-empty">The sample page needs its database. See the README to start it.</p>;
  }
  const data = await getHousehold(slug);
  if (!data) notFound();
  const { household, needs, payments } = data;
  const profile: Profile = { ...DEFAULT_PROFILE, ...(household.profile as Partial<Profile>) };
  const w = pronounWords(profile.pronoun);
  const cash = evaluateGift({ id: "cash", date: today(), amount: 300, delivery: "cash", category: "other" }, profile);
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
      title: n.title,
      detail: n.detail,
      amount: Number(n.amount),
      funded: Number(n.funded),
      payeeName: n.payeeName,
      route: n.route,
      status: n.status,
      rulePlain: r.explanation.plain,
      ruleIds: r.ruleIds,
      checkAfter: r.checkAfter,
      paidBy: p?.payerName?.split(" ")[0] ?? null,
      orderId: p?.orderId ?? null,
      captureId: p?.captureId ?? null,
    };
  });
  const open = views.filter((v) => v.status !== "paid");
  const paidTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
  const openTotal = open.reduce((s, v) => s + Math.max(0, v.amount - v.funded), 0);
  const saved = payments.filter((p) => p.route === "able" && !p.needId).reduce((s, p) => s + Number(p.amount), 0);
  const latest = payments[0]?.orderId ?? null;

  return (
    <>
      <header className="gift-head">
        <div className="title-row">
          <h1 className="gift-title">Help {household.name}</h1>
          <Info id="page.gift" />
        </div>
        <p className="gift-note">{household.note}</p>
        <p className="gift-sample muted">
          {household.isSample
            ? "Sample household for the demo. Names and shops are fictional."
            : "Made from a fundraiser page, in the PayPal sandbox. Figures assume the 2026 federal SSI amount and no other income. In the sandbox, every shop is paid through one test business account."}
        </p>
      </header>
      <div className="gift-layout">
        <div className="gift-needs">
          <div className="title-row">
            <h2 className="gift-h2">What {household.name} needs</h2>
            <Info id="gift.needs" />
          </div>
          <div className="gift-list">
            {views.map((v) => (
              <NeedCard key={v.id} need={v} name={household.name} />
            ))}
          </div>
          <div className="gift-real">
            <RealWorld />
          </div>
        </div>
        <aside className="gift-aside" aria-labelledby="month-h">
          <GiveAny slug={slug} name={household.name} needs={openNeeds(needs)} date={today()} profile={profile} />
          <div className="gift-month" data-ui>
            <div className="title-row">
              <h2 id="month-h" className="gift-month-title">
                {household.name}&rsquo;s month
              </h2>
              <Info id="gift.month" label="" />
            </div>
            <p className="gift-k">SSI check, every month</p>
            <p className="gift-check tabular">{usd(cash.checkBaseline)}</p>
            <dl className="gift-facts">
              <div>
                <dt>Given so far</dt>
                <dd className="tabular">{usd(paidTotal)}</dd>
              </div>
              <div>
                <dt>Still needed</dt>
                <dd className="tabular">{usd(openTotal)}</dd>
              </div>
              {saved > 0 && (
                <div>
                  <dt>Saved in {w.poss} ABLE account</dt>
                  <dd className="tabular">{usd(saved)}</dd>
                </div>
              )}
              <div>
                <dt>Counted as income</dt>
                <dd className="tabular">$0</dd>
              </div>
            </dl>
            {latest && (
              <Link className="text-link gift-latest" href={`/r/${latest}`}>
                See the latest receipt
              </Link>
            )}
            <Link className="text-link gift-latest" href={`/g/${slug}/report`}>
              {household.name}&rsquo;s report to Social Security
            </Link>
            <Link className="text-link gift-latest" href={`/g/${slug}/report/easy`}>
              The same report in Easy Read, for {household.name}
            </Link>
            <Link className="text-link gift-latest" href={`/g/${slug}/calendar`}>
              {household.name}&rsquo;s benefit calendar
            </Link>
            {household.isSample && (
              <Link className="text-link gift-latest" href="/dashboard">
                See {household.name}&rsquo;s year
              </Link>
            )}
          </div>
          <details className="gift-cash">
            <summary>Prefer to give cash?</summary>
            <p>
              Cash counts as {w.poss} income. A $300 cash gift would lower {w.poss} check to {usd(cash.checkAfter)}. Paying for one of these needs instead keeps {w.poss} full{" "}
              {usd(cash.checkBaseline)}.{" "}
              <Link className="text-link" href="/try">
                Check any gift
              </Link>
            </p>
          </details>
          <div className="gift-sandbox">
            <div className="title-row">
              <p className="gift-sandbox-title">Paying in the sandbox</p>
              <Info id="gift.sandbox" label="" />
            </div>
            <p>No real money moves. In the PayPal window, log in with this sandbox buyer:</p>
            <SandboxLogin compact />
            {household.isSample && <ResetSample slug={slug} />}
          </div>
        </aside>
      </div>
    </>
  );
}

// The slug is runtime data, so the whole page, header included, is read inside Suspense.
export default function Page({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <div className="gift frame">
      <Suspense fallback={<p className="gift-empty">Loading the gift page…</p>}>
        <GiftPage params={params} />
      </Suspense>
    </div>
  );
}
