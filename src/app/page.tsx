import Image from "next/image";
import Link from "next/link";
import billResults from "../../content/eval-results.json";
import fieldResults from "../../content/eval/field-cases-results.json";
import ssaResults from "../../content/eval/ssa-examples-results.json";
import facts from "../../content/facts.json";
import sampleYear from "../../content/sample-year.json";
import sources from "../../content/sources.json";
import { GiftChecker } from "@/components/GiftChecker";
import { Info } from "@/components/Info";
import { OpenOnHash } from "@/components/OpenOnHash";
import { CtaDialog } from "@/components/landing/CtaDialog";
import { Faq } from "@/components/landing/Faq";
import { HowNav } from "@/components/landing/HowNav";
import { LoopVideo } from "@/components/landing/LoopVideo";
import { ShowcaseBoard } from "@/components/landing/ShowcaseBoard";
import { WhatIsNew } from "@/components/WhatIsNew";
import { IMPACT, housingReach, payItYourself } from "@/lib/impact";
import { checkMonthName, usd } from "@/lib/rules";
import "./landing.css";

const SRC = sources as Record<string, { title: string; url: string }>;
const A = facts.audience;

/** `tech` is the citation, shown in the technical view only. */
const HOW = [
  { clause: "First a need arrives.", card: { title: "Wheelchair repair", meta: "$420 to Riverside Mobility (sample)", tech: "", status: "Reading the quote" } },
  { clause: "Then the rule is checked.", card: { title: "Wheelchair repair", meta: "Paid to the shop: not counted.", tech: "POMS SI 00815.400", status: "Rule found" } },
  { clause: "Then PayPal pays the shop.", card: { title: "Wheelchair repair", meta: "Dan paid $420 with PayPal. Sandbox ID 8RT41...", tech: "", status: "Paid" } },
  { clause: "Her month stays steady.", card: { title: "Her check", meta: "Stays whole. Savings: $1,240 of $2,000", tech: "", status: "Steady" } },
];

/** The two published counts that show why housing help matters, each from the source it links to. */
const HOUSING_HARM = [
  { fig: "793,000", text: "people on SSI whose check Social Security lowered in a single month for food or housing someone else provided.", src: "fr-88-9779-ism-count", srcLabel: "SSA, January 2022" },
  { fig: "$410 million", text: "in SSI overpayments in one year from in-kind support: help with food or housing that should have lowered the check, found after it was paid.", src: "ssa-oig-152601", srcLabel: "SSA Inspector General, FY 2024" },
  { fig: "454,843", text: "people on SSI whose check was lowered in December 2024 for shelter someone else helped with, by an average of $247 a month; Giftwise exists so help from family does not become that line.", src: "ssa-asr-2024-sect02", srcLabel: "SSI Annual Statistical Report 2024" },
  { fig: "9 percent", text: "of SSI overpayments in fiscal years 2020 through 2023 that SSA attributed to unreported living arrangements or in-kind support; Giftwise pays the shop or the ABLE account, so there is nothing in-kind to report.", src: "ssa-oig-062405", srcLabel: "SSA Inspector General, February 2025" },
  { fig: "$132 a month", text: "the average rise SSA projected for about 41,000 people when its rental subsidy rule took effect: the agency's own pricing of how much housing help from others lowers a check.", src: "fr-89-25507-rental-subsidy", srcLabel: "89 FR 25507, April 2024" },
];
const ABLE_COUNTS = [
  { fig: "8 million", text: `people potentially eligible for an ABLE account under the original law, and ${A.able_newly_eligible.value} more since January 1, 2026.`, src: "able-nrc-age-case-summary", srcLabel: "ABLE National Resource Center, 2025" },
  { fig: "246,000", text: "ABLE accounts opened by March 31, 2026, holding over $3.2 billion. Every Giftwise gift with money left over goes to one.", src: "able-nrc-accounts-2026", srcLabel: "ABLE NRC, June 2026" },
];
const RESEARCH = ["cfr-416-1103-g", "poms-si-00815-400", "poms-si-01130-740", "fr-89-21199", "ssa-understanding-ssi-living", "sna-crowdfunding", "hhl-survey-2026", "berliner-kenworthy-2017"];
const RESEARCH_LABEL: Record<string, string> = {
  "cfr-416-1103-g": "20 CFR 416.1103(g)",
  "poms-si-00815-400": "POMS SI 00815.400",
  "poms-si-01130-740": "POMS SI 01130.740",
  "fr-89-21199": "89 FR 21199 (2024)",
  "ssa-understanding-ssi-living": "SSA Understanding SSI",
  "sna-crowdfunding": "Special Needs Alliance guidance",
  "hhl-survey-2026": "Help Hope Live survey (2026)",
  "berliner-kenworthy-2017": "Berliner and Kenworthy (2017)",
};

/** Help delivered each month in the sample year, summed from content/sample-year.json (the same gifts as the dashboard and the report). */
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const HELP = [...new Set(sampleYear.gifts.map((g) => g.date.slice(0, 7)))].sort().map((month) => ({
  m: MONTH_ABBR[Number(month.slice(5, 7)) - 1],
  v: sampleYear.gifts.filter((g) => g.date.startsWith(month)).reduce((s, g) => s + g.amount, 0),
}));
const HELP_SPAN = `${MONTH_FULL[MONTH_ABBR.indexOf(HELP[0].m)]} to ${MONTH_FULL[MONTH_ABBR.indexOf(HELP[HELP.length - 1].m)]} 2026`;
const HELP_TOTAL = HELP.reduce((s, h) => s + h.v, 0);
const HELP_MAX = HELP.reduce((mi, h, i, arr) => (h.v > arr[mi].v ? i : mi), 0);
const PRINTED = [...new Set([HELP_MAX, 0, HELP.length - 1])];
const YEAR = payItYourself();
const HOUSING = housingReach();
const cents = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** For developers and anyone running it: one entry, four pages. */
const FOR_DEVELOPERS = [
  { href: "/developers", label: "Developers", what: "API keys, the docs, and the MCP server for AI agents" },
  { href: "/status", label: "Status", what: "Every service, checked live" },
  { href: "/ops", label: "Operations", what: "Latency, errors, payments and webhooks" },
  { href: "/stack", label: "How it is built", what: "Every PayPal API and tool, with its file" },
];

/** One published count: the figure leading its line, then what it counts and its source. */
function ReachRow({ r }: { r: { fig: string; text: string; src: string; srcLabel: string } }) {
  return (
    <li className="reach-row">
      <span className="reach-fig tabular">{r.fig}</span>
      <span className="reach-text">
        {r.text}{" "}
        <a className="text-link muted reach-src" href={SRC[r.src].url} target="_blank" rel="noreferrer">
          {r.srcLabel}
        </a>
      </span>
    </li>
  );
}

export default function Home() {
  const later = HOUSING.years[HOUSING.years.length - 1];
  return (
    <>
      {/* Hero: "Column on one line" beside the live Gift Checker */}
      <section className="hero frame grid-12" aria-labelledby="hero-title">
        <div className="hero-col">
          <h1 id="hero-title" className="hero-title">
            Give so she keeps <br />
            her full check
          </h1>
          <p className="hero-sub">
            For someone on SSI, a cash gift can lower the monthly check. Giftwise checks every gift against Social Security&rsquo;s rules, and PayPal pays only the shops, clinics and ABLE account the
            rules picked, in one order, captured once. Claude reads the bills; the rules do the math.
          </p>
          <ul className="hero-impact" aria-label="What routing keeps, measured by the rules engine">
            <li>
              <Link className="hero-impact-link" href="/evidence/impact#kept">
                <span className="hero-impact-fig tabular" data-kept="">
                  {usd(Math.round(IMPACT.familyTotal))}
                </span>
                <span className="hero-impact-what">
                  kept by {IMPACT.familyCases.length === 2 ? "two" : IMPACT.familyCases.length} families in real court cases, over the {IMPACT.familyCases.map((c) => c.months).join(" and ")} months their
                  cases cover, routed through Giftwise at 2026 rates
                </span>
                <span className="hero-impact-base tabular">
                  {usd(Math.round(IMPACT.keptMin))} to {usd(Math.round(IMPACT.keptMax))} a month in {IMPACT.routedCases} of {IMPACT.scoredCases} cases
                </span>
              </Link>
            </li>
            <li>
              <Link className="hero-impact-link" href="/evidence/impact#why">
                <span className="hero-impact-fig tabular" data-kept="">
                  {cents(YEAR.totalLowered)}
                </span>
                <span className="hero-impact-what">kept in Maya&rsquo;s sample year by one shared page, against {YEAR.givers} givers each paying on their own</span>
                <span className="hero-impact-base tabular">
                  {YEAR.monthsLowered} monthly checks whole that would have dropped
                </span>
              </Link>
            </li>
          </ul>
          <div className="hero-actions">
            <Link href="/try#fundraiser" className="btn btn-primary">
              Start a gift page
            </Link>
            <Link href="/evidence" className="text-link">
              The five-minute path
            </Link>
          </div>
          <p className="hero-note muted">
            For people on SSI, their families and benefits counselors. <Info id="hero.who" />
          </p>
        </div>
        <div className="hero-fragment">
          <GiftChecker />
          {/* PayPal as the place the rules are enforced, with the two proofs anyone can open beside the checker. */}
          <div className="hero-proof">
            <p className="hero-proof-line">
              Money can reach only a payee the rules picked: one PayPal order, captured once, with a report anyone can check.
            </p>
            <p className="hero-proof-links">
              <Link className="text-link" href="/g/maya/report?month=2026-10#rp-verify-h">
                Verify a report
              </Link>
              <Link className="text-link" href="/evidence/rules#referee">
                See the referee
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* What is new, in the first two screens: the report anyone can check, the referee, and the agent that asks first. */}
      <div className="frame grid-12 home-new">
        <WhatIsNew headingId="new-title" />
      </div>

      {/* Intro: a statement with inline pictures */}
      <section className="intro frame" aria-labelledby="intro-title">
        <h2 id="intro-title" className="sr-only">
          The rule in one sentence
        </h2>
        <p className="intro-statement" data-reveal>
          Cash gifts count as income. Paying the shop for her wheelchair{" "}
          <span className="thumb">
            <Image src="/images/paralympic-wheelchair-tyre-inflation.jpg" alt="Two technicians repairing a wheelchair tyre" width={120} height={80} />
          </span>
          , laptop{" "}
          <span className="thumb">
            <Image src="/images/laptop-on-desk-book-stacks-unsplash.jpg" alt="A laptop on a desk beside a stack of books" width={120} height={80} />
          </span>{" "}
          or medicine{" "}
          <span className="thumb">
            <Image src="/images/pharmacy-shop-interior-counter-work-fortepan-74179.jpg" alt="Pharmacists at work behind a pharmacy counter" width={120} height={80} />
          </span>{" "}
          does not. <Info id="intro.rule" />
        </p>
      </section>

      {/* How it works: one card, four fields. On a phone the four fields sit in one row that scrolls sideways, the next
          one peeking in, with Previous and Next beside the heading. */}
      <section id="how" className="how" aria-labelledby="how-title">
        <div className="how-heading">
          <h2 id="how-title">How it works</h2>
          <HowNav track="how-track" count={HOW.length} />
        </div>
        <ol id="how-track" className="how-track" aria-labelledby="how-title">
          {HOW.map((h, i) => (
            <li key={h.clause} className="how-field" data-field={i}>
              <div className="how-card" data-ui data-reveal style={{ ["--reveal-i" as string]: i }}>
                <p className="how-card-title">{h.card.title}</p>
                <p className="how-card-meta tabular">
                  {h.card.meta}
                  {h.card.tech && <span className="how-tech"> {h.card.tech}</span>}
                </p>
                <p className="how-card-status" data-step={i}>
                  {h.card.status}
                </p>
              </div>
              <p className="how-clause">{h.clause}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Showcase: rows as a board */}
      <section className="showcase" aria-labelledby="showcase-title">
        <div className="frame showcase-head">
          <div className="showcase-copy">
            <h2 id="showcase-title" className="section-title">
              Every request, routed
            </h2>
            <p className="lede">Repairs, school costs, bills and birthdays. Each need has a best way to arrive, and Giftwise picks it.</p>
          </div>
          <figure className="showcase-photo">
            <LoopVideo src="/media/wheelchair-basketball.webm" poster="/media/wheelchair-basketball-poster.jpg" width={854} height={480} />
            <Image className="loop-poster" src="/media/wheelchair-basketball-poster.jpg" alt="" width={854} height={480} aria-hidden="true" />
            <figcaption className="muted">Life, uninterrupted. Wheelchair basketball at the University of Worcester.</figcaption>
          </figure>
        </div>
        <ShowcaseBoard />
      </section>

      {/* The proof: who each route reaches, measured, then the three checks open, then one disclosure for the published
          counts, the sample year month by month and every source. */}
      <section className="section frame evidence" aria-labelledby="reach-title">
        <h2 id="reach-title" className="section-title">
          Who it reaches
        </h2>
        <ul className="reach-list">
          <li className="reach-row">
            <span className="reach-fig tabular">{A.ssi_jan2025_total.value}</span>
            <span className="reach-text">
              people on SSI keep their full check when a gift pays the shop, the clinic, the pharmacy or the school. Items, care and school costs reach everyone.{" "}
              <a className="text-link muted reach-src" href={SRC["crs-if10482"].url} target="_blank" rel="noreferrer">
                CRS, January 2025
              </a>
            </span>
          </li>
          <li className="reach-row">
            <span className="reach-fig tabular">Rent</span>
            <span className="reach-text">
              stays whole through an ABLE account, for anyone whose disability began before {HOUSING.onsetAge}, including all {A.ssi_jan2025_children.value} children on SSI. Without one, the rules cap the cut:{" "}
              {usd(HOUSING.amount)} of rent from family leaves the {checkMonthName(later.paymentMonth)} check at {usd(later.rentWithoutAble)} of {usd(later.full)}, and Giftwise says so first.{" "}
              <Link className="text-link muted reach-src" href="/evidence/impact#reach">
                Measured
              </Link>
            </span>
          </li>
        </ul>
        <div className="ev-checks">
          <h3 className="ev-sub">How the rules were checked</h3>
          <ul className="research-proof">
            <li>
              <Link className="research-proof-link" href="/evidence/ssa-examples">
                <span className="research-proof-fig tabular">
                  {ssaResults.summary.engine_matches} of {ssaResults.summary.cases}
                </span>
                <span>of Social Security&rsquo;s own worked examples match SSA&rsquo;s answer</span>
              </Link>
            </li>
            <li>
              <Link className="research-proof-link" href="/evidence/court-cases">
                <span className="research-proof-fig tabular">
                  {fieldResults.summary.agreed} of {fieldResults.summary.scored}
                </span>
                <span>real SSI cases from federal courts reach the outcome SSA and the court did</span>
              </Link>
            </li>
            <li>
              <Link className="research-proof-link" href="/evidence/rules#evaluation">
                <span className="research-proof-fig tabular">
                  {billResults.summary.referee.check_kept_whole} of {billResults.summary.referee.all_cases}
                </span>
                <span>labeled bills routed so her check stays whole</span>
              </Link>
            </li>
          </ul>
        </div>
        <details id="evidence-more" className="ev-more">
          <summary>Housing and ABLE counts, the sample year month by month, and all {RESEARCH.length} sources</summary>
          <div className="ev-more-body">
            <ul className="reach-list">
              {[...HOUSING_HARM, ...ABLE_COUNTS].map((r) => (
                <ReachRow key={r.fig} r={r} />
              ))}
            </ul>

            {/* The sample year: bars standing on the edge */}
            <div className="stats">
              <div className="stats-head">
                <h3 className="stats-title">
                  <span className="stats-figure tabular">$0</span> <span className="stats-claim">counted against her all year</span>
                </h3>
                <p className="stats-sub">
                  Sample household, {HELP_SPAN}: {usd(HELP_TOTAL)} of help from {YEAR.givers} people, every gift through Giftwise. Her check stayed {usd(facts.values.fbr_individual.value)} every month, the
                  full 2026 check.
                </p>
              </div>
              <div className="bars" data-ui role="list" aria-label="Help delivered each month in the sample year">
                {HELP.map((h, i) => (
                  <div
                    key={h.m}
                    role="listitem"
                    className="bar"
                    data-accent={i === HELP_MAX ? "" : undefined}
                    data-print={PRINTED.includes(i) ? "" : undefined}
                    tabIndex={0}
                    style={{ ["--h" as string]: `${(h.v / HELP[HELP_MAX].v) * 84}%` }}
                    aria-label={`${h.m}: ${usd(h.v)} of help, $0 counted`}
                  >
                    <span className="bar-value tabular">{usd(h.v)}</span>
                    <span className="bar-fill" aria-hidden="true" />
                    <span className="bar-month">{h.m}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Grounded in research: names as one line */}
            <div className="research">
              <figure className="research-photo">
                <Image
                  src="/images/pharmacy-shop-interior-counter-work-fortepan-74179.jpg"
                  alt="Archival photograph of pharmacists working at a pharmacy counter"
                  width={960}
                  height={680}
                  sizes="(max-width: 900px) 100vw, 30vw"
                />
                <figcaption className="muted">A pharmacy counter. Medicine paid straight to the pharmacy is not counted as income.</figcaption>
              </figure>
              <p className="research-line">
                Grounded in{" "}
                {RESEARCH.map((k, i) => (
                  <span key={k}>
                    <a className="text-link" href={SRC[k].url} target="_blank" rel="noreferrer">
                      {RESEARCH_LABEL[k]}
                    </a>
                    {i < RESEARCH.length - 2 ? ", " : i === RESEARCH.length - 2 ? " and " : "."}
                  </span>
                ))}
              </p>
            </div>
          </div>
        </details>
      </section>

      {/* FAQ: question index, one answer */}
      <section className="section frame faq-section" aria-labelledby="faq-title">
        <h2 id="faq-title" className="section-title">
          Plain answers
        </h2>
        <Faq bills={billResults.summary.referee.all_cases} billsKeptWhole={billResults.summary.referee.check_kept_whole} />
      </section>

      {/* CTA: first step, already open */}
      <section className="cta section" aria-labelledby="cta-title">
        <div className="cta-copy">
          <h2 id="cta-title" className="cta-title">
            Start with <br />
            one gift
          </h2>
          <p className="cta-sub">Paste a fundraiser&rsquo;s link, or start from the sample. Giftwise turns each need into a gift that arrives the <span className="cta-keep">benefit-safe way</span>.</p>
        </div>
        <CtaDialog />
      </section>

      {/* For developers and anyone running it: one row, out of the giver's way. */}
      <nav className="frame home-dev" aria-labelledby="home-dev-title">
        <h2 id="home-dev-title" className="home-dev-h">
          For developers
        </h2>
        <ul className="home-dev-list">
          {FOR_DEVELOPERS.map((d) => (
            <li key={d.href}>
              <Link className="text-link home-dev-link" href={d.href}>
                {d.label}
              </Link>
              <span className="muted home-dev-what">{d.what}</span>
            </li>
          ))}
        </ul>
      </nav>
      {/* A link to anything inside the evidence disclosure opens it first. */}
      <OpenOnHash />
    </>
  );
}
