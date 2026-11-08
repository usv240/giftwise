import type { Metadata } from "next";
import Link from "next/link";
import { OpenOnHash } from "@/components/OpenOnHash";
import { Adoption, Pilot } from "@/components/judges/Adoption";
import { Compare } from "@/components/judges/Compare";
import { PayPalShare, PayYourself, Reach } from "@/components/judges/WhyGiftwise";
import { ASKED_BASIS, ASKED_SENTENCE, IMPACT, KEPT_BASIS, KEPT_SENTENCE } from "@/lib/impact";
import "../../pages.css";
import "../../developers/dev.css";
import "../evidence.css";

export const metadata: Metadata = {
  title: "What it changes, and for whom",
  description: "What routing would have kept in real court cases, who each route reaches, why one shared page beats paying the shop yourself, how it compares, and who runs it first.",
};

const cents = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function ImpactPage() {
  return (
    <div className="page frame evidence evidence-sub">
      <OpenOnHash />
      <header className="page-head">
        <p className="jx-crumb">
          <Link className="text-link" href="/evidence">
            Evidence
          </Link>
        </p>
        <h1 className="page-title">What it changes, and for whom</h1>
        <p className="lede">Each figure is the rules engine run on real cases or on the sample year, or a published count with its source.</p>
      </header>

      <section id="kept" className="page-section" aria-labelledby="kept-h">
        <h2 id="kept-h">What routing would have kept, case by case</h2>
        <p className="page-prose jp-intro">
          {KEPT_SENTENCE} {KEPT_BASIS} These are the engine&rsquo;s counterfactuals on each case&rsquo;s facts, not outcomes anyone saw.
        </p>
        <dl className="why-list">
          {IMPACT.keptCases.map((c) => (
            <div key={c.id} className="why-row">
              <dt>
                <span className="why-fig tabular">{cents(c.kept)}</span> a month
              </dt>
              <dd>
                {c.title}. <span className="muted">{c.citation.replace(/^.*?,\s*(No\.)/, "$1")}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="asked" className="page-section" aria-labelledby="asked-h">
        <h2 id="asked-h">What SSA asked back, and what the engine finds</h2>
        <p className="page-prose jp-intro">
          {ASKED_SENTENCE} {ASKED_BASIS}
        </p>
        <dl className="why-list">
          {IMPACT.askedCases.map((c) => (
            <div key={c.id} className="why-row">
              <dt>
                <span className="why-fig tabular">{cents(c.amount)}</span> asked back
              </dt>
              <dd>
                {c.title}
                {c.period !== "not stated" ? `, ${c.period}` : ""}. As given, the engine puts her savings over the $2,000 limit, as SSA found.
                {c.avoidedThroughAble ? " Paid into an ABLE account instead, her savings stay under it every month." : ""}
              </dd>
            </div>
          ))}
        </dl>
        <p className="muted why-src">
          overpaymentCheck() in scripts/run-field-cases.ts, written to content/eval/field-cases-results.json.{" "}
          <Link className="text-link" href="/evidence/court-cases">
            All the court cases
          </Link>
        </p>
      </section>

      <section id="reach" className="page-section" aria-labelledby="reach-h">
        <h2 id="reach-h">Who each route reaches</h2>
        <Reach />
      </section>

      <section id="why" className="page-section" aria-labelledby="why-h">
        <h2 id="why-h">Why not pay the shop yourself?</h2>
        <PayYourself />
      </section>

      <section id="paypal-share" className="page-section" aria-labelledby="pp-h">
        <h2 id="pp-h">The part PayPal carries</h2>
        <PayPalShare />
      </section>

      <section id="compare" className="page-section" aria-labelledby="cmp-h">
        <h2 id="cmp-h">How it compares</h2>
        <p className="page-prose jp-intro">Each of these does its own job well, from its own published pages. Giftwise is built for the moment a gift is given, and works alongside them.</p>
        <Compare />
      </section>

      <section id="adoption" className="page-section" aria-labelledby="ad-h">
        <h2 id="ad-h">Who runs it first</h2>
        <p className="page-prose jp-intro">Three groups already help people on SSI with money every month. Each can run Giftwise as it is today.</p>
        <Adoption />
        <Pilot />
      </section>
    </div>
  );
}
