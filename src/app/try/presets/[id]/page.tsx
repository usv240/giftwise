import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Info } from "@/components/Info";
import { PresetResult } from "@/components/try/PresetResult";
import { LiveBillRead } from "@/components/try/LiveBillRead";
import { ReviewPanel } from "@/components/try/ReviewPanel";
import { AI_DAILY_CAP_USD } from "@/lib/ai/claude";
import { SAMPLE_BILL } from "@/lib/ai/sample-bill";
import { reviewForPreset } from "@/lib/review/cases";
import { PRESETS, getPreset } from "@/lib/presets";
import { fullCheckByYear, usd } from "@/lib/rules";
import "../../try.css";

export function generateStaticParams() {
  return PRESETS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = getPreset(id);
  return { title: p ? `${p.title} example` : "Example" };
}

async function Preset({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getPreset(id);
  if (!p) notFound();
  const gifts = p.gifts ?? (p.gift ? [p.gift] : []);
  const review = reviewForPreset(p.id);
  return (
    <div className="try frame">
      <p>
        <Link href="/try" className="text-link">
          All examples
        </Link>
      </p>
      <header className="try-head preset-head">
        <div className="title-row">
          <h1 className="try-title">{p.title}</h1>
          <Info id="try.presets" />
        </div>
        <p className="lede">{p.summary}</p>
        <p className="muted">Sample household: Maya, 29, lives on her own, has an ABLE account and $1,240 in savings. Her full SSI check is {fullCheckByYear()}.</p>
      </header>

      <div className="try-split preset-body">
        <section aria-labelledby="input-h" className="preset-input">
          <h2 id="input-h" className="presets-title">
            The input
          </h2>
          <ul className="month-gifts">
            {gifts.map((g, i) => (
              <li key={i} className="month-gift">
                <span>
                  {g.label ?? "Gift"} <span className="muted">from {g.giver ?? "someone"}</span>
                </span>
                <span className="tabular">{usd(g.amount)}</span>
                <span className="month-gift-note">
                  {g.delivery === "vendor" ? "Paid to the shop" : g.delivery === "cash" ? "Cash to her" : g.delivery === "able" ? "To her ABLE account" : "The item itself"}, {g.date}
                  {g.recurring ? ", every month" : ""}
                </span>
              </li>
            ))}
          </ul>
          <div className="try-actions">
            <a className="btn btn-quiet" href={`/api/presets/${p.id}`} download>
              Download JSON
            </a>
            <a className="btn btn-quiet" href={`/api/presets/${p.id}?format=csv`} download>
              Download CSV
            </a>
            {p.document && (
              <a className="btn btn-quiet" href={`/samples/${p.document}`} download>
                Download the sample document
              </a>
            )}
          </div>
          <p className="muted try-privacy">Use these files on the Try page or with the API to check the result yourself.</p>
        </section>
        <PresetResult id={p.id} />
      </div>
      {p.document === SAMPLE_BILL && <LiveBillRead cap={AI_DAILY_CAP_USD} />}
      {review && <ReviewPanel input={review.input} recorded={review.recorded} />}
    </div>
  );
}

// Every example id is prerendered; the id is still runtime data for navigation, so it is read inside Suspense.
export default function PresetPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="try frame page-loading">Loading the example…</p>}>
      <Preset params={params} />
    </Suspense>
  );
}
