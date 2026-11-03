import type { Metadata } from "next";
import Link from "next/link";
import credits from "../../../public/images/credits.json";
import videoCredits from "../../../public/media/credits.json";
import { Info } from "@/components/Info";
import { RealWorld } from "@/components/RealWorld";
import "../pages.css";

export const metadata: Metadata = { title: "About", description: "What Giftwise is, what it is not, how it handles data, and credits." };

type Credit = { credit?: string; page?: string; title?: string };
const ALL = [...(credits as Credit[]), ...(videoCredits as Credit[])];

export default function AboutPage() {
  return (
    <div className="page frame">
      <header className="page-head">
        <div className="title-row">
          <h1 className="page-title">About Giftwise</h1>
          <Info id="page.about" />
        </div>
        <p className="lede">Giftwise helps friends and family give to someone who receives SSI in the way that keeps her full benefits.</p>
      </header>

      <section className="page-section page-prose" aria-labelledby="what-h">
        <h2 id="what-h">What it does</h2>
        <p>
          Social Security counts cash gifts as income, but not payments made straight to a shop for her needs. Giftwise checks every gift against those rules and pays the
          shop directly through PayPal, so the help arrives and her check stays the same.
        </p>
        <p>Every answer shows the rule it comes from. Fixed rules do the money math; AI reads documents and explains.</p>
      </section>

      <section className="page-section page-prose" aria-labelledby="scope-h">
        <h2 id="scope-h">Scope</h2>
        <ul className="about-list">
          <li>Guidance based on published Social Security rules, with sources. For complex situations, such as couples, state supplements or Medicaid rules that differ by state, a benefits counselor can help.</li>
          <li>Uses the 2026 federal amounts. State supplements are not included yet.</li>
          <li>Runs in PayPal&rsquo;s sandbox, a practice version of PayPal where no real money moves.</li>
          <li>The household on the sample pages, Maya, and the shops are fictional.</li>
        </ul>
      </section>

      <div id="real" className="page-section">
        <RealWorld headingId="real-about-h" />
      </div>

      <section className="page-section page-prose" aria-labelledby="data-h">
        <h2 id="data-h">Your data</h2>
        <ul className="about-list">
          <li>Bills and pages you try are used only to show your result. Images are re-encoded to remove location data before they are read.</li>
          <li>Giftwise never holds money. Donors pay the shop or the ABLE account directly through PayPal.</li>
          <li>Every payment step is recorded in an append-only ledger with a hash chain, so the record cannot be quietly changed.</li>
        </ul>
      </section>

      <section className="page-section page-prose" aria-labelledby="open-h">
        <h2 id="open-h">Open source</h2>
        <p>
          Giftwise is open source under the MIT licence:{" "}
          <a className="text-link" href="https://github.com/usv240/giftwise">
            github.com/usv240/giftwise
          </a>
          . Built for the PayPal AI Hackathon, November 2026. See{" "}
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
