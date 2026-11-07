import type { Metadata } from "next";
import Link from "next/link";
import credits from "../../../public/images/credits.json";
import videoCredits from "../../../public/media/credits.json";
import { Info } from "@/components/Info";
import Image from "next/image";
import { RealWorld } from "@/components/RealWorld";
import { sampleYearSplit } from "@/lib/impact";
import { usd } from "@/lib/rules";
import "../pages.css";
import "./about.css";

export const metadata: Metadata = { title: "About", description: "What Giftwise is, what it is not, how it handles data, and credits." };

type Credit = { credit?: string; page?: string; title?: string };
const ALL = [...(credits as Credit[]), ...(videoCredits as Credit[])];

export default function AboutPage() {
  const year = sampleYearSplit();
  const parts = [
    { id: "paypal", label: "Paid to shops and clinics through PayPal", ...year.paypal },
    { id: "able", label: "Paid to her ABLE account through the ABLE plan’s own gift page", ...year.able },
    { id: "item", label: "Given as the item itself, a jacket, so no money moves", ...year.item },
  ].filter((p) => p.gifts > 0);
  return (
    <div className="page frame about">
      <header className="page-head">
        <div className="title-row">
          <h1 className="page-title">About Giftwise</h1>
          <Info id="page.about" />
        </div>
        <p className="lede">Giftwise helps friends and family give to someone who receives SSI in the way that keeps her full benefits.</p>
      </header>

      <section className="page-section about-what" aria-labelledby="what-h">
        <div className="page-prose">
          <h2 id="what-h">What it does</h2>
          <p>
            Social Security counts cash gifts as income, but not payments made straight to a shop for her needs. Giftwise checks every gift against those rules and pays the
            shop directly through PayPal, so the help arrives and her check stays the same.
          </p>
          <p>Every answer shows the rule it comes from. Fixed rules do the money math; AI reads documents and explains.</p>
          <p>
            How much each payee gets, the check, when money moves and who gets paid are decided by code, never by the AI.{" "}
            <Link className="text-link" href="/evidence#ai">
              What the AI never decides
            </Link>
          </p>
        </div>
        <figure className="about-photo">
          <Image
            src="/images/paralympic-wheelchair-tyre-inflation.jpg"
            alt="Two technicians repairing a wheelchair tyre"
            width={768}
            height={1024}
            sizes="(max-width: 900px) 100vw, 30vw"
          />
          <figcaption className="muted">A wheelchair repair paid straight to the shop is not counted as income.</figcaption>
        </figure>
      </section>

      <section className="page-section page-prose" aria-labelledby="scope-h">
        <h2 id="scope-h">Scope</h2>
        <ul className="about-list">
          <li>Guidance based on published Social Security rules, with sources. For complex situations, such as couples, state supplements or Medicaid rules that differ by state, a benefits counselor can help.</li>
          <li>Uses the federal amounts for the year each check is paid: 2026, and 2027 from January. Federal SSI only; a state&rsquo;s own supplement is added on top by that state.</li>
          <li>Runs in PayPal&rsquo;s sandbox, a practice version of PayPal where no real money moves.</li>
          <li>The household on the sample pages, Maya, and the shops are fictional.</li>
        </ul>
      </section>

      <section className="page-section about-year" aria-labelledby="year-h">
        <div className="page-prose">
          <h2 id="year-h">A year of gifts, run for real</h2>
          <p>
            Maya&rsquo;s sample year is {year.gifts} gifts from family and friends, {usd(year.total)} in all, and {year.checkWhole === year.gifts ? "every one" : `${year.checkWhole} of them`} keeps her check whole. Outside
            PayPal&rsquo;s sandbox, the money would move like this.
          </p>
        </div>
        <div className="about-split" role="img" aria-label={parts.map((p) => `${usd(p.amount)} ${p.label.toLowerCase()}`).join("; ")}>
          {parts.map((p) => (
            <span key={p.id} className="about-seg" data-part={p.id} style={{ flexGrow: p.amount }} />
          ))}
        </div>
        <ul className="about-parts">
          {parts.map((p) => (
            <li key={p.id}>
              <span className="about-part-amt tabular">{usd(p.amount)}</span>
              <span className="about-swatch" data-part={p.id} aria-hidden="true" />
              <span className="about-part-what">
                {p.label} <span className="muted tabular">({p.gifts} {p.gifts === 1 ? "gift" : "gifts"})</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="muted about-year-src">Each gift runs through the rules engine; the gifts are the ones on the dashboard and in her reports.</p>
      </section>

      <div id="real" className="page-section">
        <RealWorld headingId="real-about-h" />
      </div>

      <section className="page-section page-prose" aria-labelledby="data-h">
        <h2 id="data-h">Your data</h2>
        <ul className="about-list">
          <li>Bills and pages you try are used only to show your result. Images are re-encoded to remove location data before they are read.</li>
          <li>Giftwise never holds money. Donors pay the shop or the ABLE account directly through PayPal.</li>
          <li>Every payment step is written down in order and can&rsquo;t be changed later (an append-only ledger with a hash chain).</li>
        </ul>
      </section>

      <section className="page-section page-prose" aria-labelledby="open-h">
        <h2 id="open-h">Open source</h2>
        <p>
          Giftwise is open source under the MIT license. See{" "}
          <Link className="text-link" href="/stack">
            how it is built
          </Link>{" "}
          and the{" "}
          <Link className="text-link" href="/learn#sources">
            sources
          </Link>
          .
        </p>
      </section>

      <section className="page-section" aria-labelledby="credits-h">
        <h2 id="credits-h">Picture and video credits</h2>
        <ul className="credits-list">
          {ALL.map((c, i) => (
            <li key={i}>
              {c.page ? (
                <a className="text-link" href={c.page}>
                  {c.credit ?? c.title}
                </a>
              ) : (
                (c.credit ?? c.title)
              )}
            </li>
          ))}
          <li>Typeface: Clash Grotesk by Indian Type Foundry, ITF Free Font License.</li>
        </ul>
      </section>
    </div>
  );
}
