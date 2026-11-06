import Image from "next/image";
import Link from "next/link";
import facts from "../../content/facts.json";
import billResults from "../../content/eval-results.json";
import fieldResults from "../../content/eval/field-cases-results.json";
import ssaResults from "../../content/eval/ssa-examples-results.json";
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
import { usd } from "@/lib/rules";
import "./landing.css";

const V = facts.values;
const SRC = sources as Record<string, { title: string; url: string }>;

const RULE_ROWS = [
  { id: "rules.limit", name: "Savings limit on the first of each month", value: usd(V.resource_limit_individual.value), href: "/learn#savings" },
  { id: "rules.fbr", name: `SSI federal payment, 2026 (2027: ${usd(V.fbr_individual_2027.value)})`, value: usd(V.fbr_individual.value), href: "/learn#payment" },
  { id: "rules.infrequent", name: "One-off gifts not counted, per quarter", value: `first ${usd(V.infrequent_unearned_per_quarter.value)}`, href: "/learn#exclusions" },
  { id: "rules.gie", name: "General monthly exclusion", value: usd(V.general_income_exclusion.value), href: "/learn#exclusions" },
  { id: "rules.pmv", name: "Most that housing help can lower the check", value: usd(V.pmv_individual.value), href: "/learn#housing" },
  { id: "rules.able-limit", name: "ABLE contributions per year", value: usd(V.able_annual_limit.value), href: "/learn#able" },
  { id: "rules.able-balance", name: "ABLE balance not counted toward savings", value: `first ${usd(V.able_resource_exclusion.value)}`, href: "/learn#able" },
];

/** `tech` is the citation, shown in the technical view only. */
const HOW = [
  { clause: "First a need arrives.", card: { title: "Wheelchair repair", meta: "$420 to Riverside Mobility (sample)", tech: "", status: "Reading the quote" } },
  { clause: "Then the rule is checked.", card: { title: "Wheelchair repair", meta: "Paid to the shop: not counted.", tech: "POMS SI 00815.400", status: "Rule found" } },
  { clause: "Then PayPal pays the shop.", card: { title: "Wheelchair repair", meta: "Dan paid $420 with PayPal. Sandbox ID 8RT41...", tech: "", status: "Paid" } },
  { clause: "Her month stays steady.", card: { title: "June check", meta: "$994. Savings on July 1: $1,240 of $2,000", tech: "", status: "Steady" } },
];

const BUILT = [
  { id: "paypal", tool: "PayPal", job: "Pays the shop directly, and keeps the month's ledger" },
  { id: "claude", tool: "Claude Opus 5.5", job: "Reads bills and runs the two reviewers" },
  { id: "ag-studio", tool: "AG Studio", job: "The dashboard of Maya's year, with a rules-engine widget" },
  { id: "bryntum", tool: "Bryntum", job: "Her benefit calendar, where gifts can be dragged between months" },
  { id: "render", tool: "Render", job: "Hosts the site and its database" },
  { id: "apimatic", tool: "APIMatic", job: "Generated the PayPal SDK Giftwise builds with" },
];

/** Published counts only, each from the source it links to. */
const REACH = [
  { fig: "793,000", text: "people on SSI whose check Social Security lowered in a single month for food or housing someone else provided.", src: "fr-88-9779-ism-count", srcLabel: "SSA, January 2022" },
  { fig: "$410 million", text: "in SSI overpayments in one year from in-kind support: help with food or housing that should have lowered the check, found after it was paid. Giftwise checks every gift before PayPal moves it.", src: "ssa-oig-152601", srcLabel: "SSA Inspector General, FY 2024" },
  { fig: "14 million", text: "people who can open an ABLE account: about 8 million under the original law and an estimated 6 million more since January 1, 2026.", src: "able-nrc-age-case-summary", srcLabel: "ABLE National Resource Center" },
  { fig: "246,000", text: "ABLE accounts open so far, holding over $3.2 billion. Every Giftwise gift with money left over goes to one.", src: "able-nrc-accounts-2026", srcLabel: "ABLE NRC, March 31, 2026" },
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

// Sample household: help delivered each month through Giftwise (all routed benefit-safe).
/** Help delivered each month in the sample year, summed from content/sample-year.json (the same gifts as the dashboard and the report). */
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HELP = [...new Set(sampleYear.gifts.map((g) => g.date.slice(0, 7)))].sort().map((month) => ({
  m: MONTH_ABBR[Number(month.slice(5, 7)) - 1],
  v: sampleYear.gifts.filter((g) => g.date.startsWith(month)).reduce((s, g) => s + g.amount, 0),
}));
const HELP_SPAN = `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][MONTH_ABBR.indexOf(HELP[0].m)]} to ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][MONTH_ABBR.indexOf(HELP[HELP.length - 1].m)]} 2026`;
const HELP_TOTAL = HELP.reduce((s, h) => s + h.v, 0);
const HELP_MAX = HELP.reduce((mi, h, i, arr) => (h.v > arr[mi].v ? i : mi), 0);
const PRINTED = [...new Set([HELP_MAX, 0, HELP.length - 1])];

/** One published count: the figure leading its line, then what it counts and its source. */
function ReachRow({ r }: { r: (typeof REACH)[number] }) {
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
            For someone on SSI, a cash gift can lower the monthly check. Giftwise checks every gift against Social Security&rsquo;s rules and pays the shop directly through PayPal. Claude reads the bills and fundraiser pages; the rules do the math.
          </p>
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
        </div>
      </section>

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

      {/* The rules, simply: two-ended rows */}
      <section className="section frame rules" aria-labelledby="rules-title">
        <div className="rules-col">
          <h2 id="rules-title" className="rules-title">
            Seven numbers
          </h2>
          <p className="muted rules-sub">Most of the rules come down to these. Each links to its source.</p>
          <ul className="rules-list">
            {RULE_ROWS.map((r, i) => (
              <li key={r.id} className="rules-row" data-reveal style={{ ["--reveal-i" as string]: i }}>
                <span className="rules-name">
                  <Link href={r.href} className="rules-link">
                    {r.name}
                  </Link>
                  <Info id={r.id} label="" />
                </span>
                <span className="rules-value tabular">{r.value}</span>
              </li>
            ))}
          </ul>
        </div>
        <figure className="rules-figure">
          <Image
            src="/images/india-kolkata-electricity-meters-3832.jpg"
            alt="A wall of household electricity meters"
            width={960}
            height={638}
            sizes="(max-width: 900px) 100vw, 40vw"
          />
          <figcaption className="muted">Utilities count as housing support when someone else pays them.</figcaption>
        </figure>
      </section>

      {/* Evidence: the strongest published counts and the three checks open, then one disclosure for the ABLE counts,
          the sample year month by month and every source. */}
      <section className="section frame evidence" aria-labelledby="reach-title">
        <h2 id="reach-title" className="section-title">
          Who it reaches
        </h2>
        <ul className="reach-list">
          {REACH.slice(0, 2).map((r) => (
            <ReachRow key={r.fig} r={r} />
          ))}
        </ul>
        <div className="ev-checks">
          <h3 className="ev-sub">How the rules were checked</h3>
          <ul className="research-proof">
            <li>
              <Link className="research-proof-link" href="/evidence#ssa-examples">
                <span className="research-proof-fig tabular">
                  {ssaResults.summary.engine_matches} of {ssaResults.summary.cases}
                </span>
                <span>of Social Security&rsquo;s own worked examples match SSA&rsquo;s answer</span>
              </Link>
            </li>
            <li>
              <Link className="research-proof-link" href="/evidence#field-cases">
                <span className="research-proof-fig tabular">
                  {fieldResults.summary.agreed} of {fieldResults.summary.scored}
                </span>
                <span>real SSI cases from federal courts reach the outcome SSA and the court did</span>
              </Link>
            </li>
            <li>
              <Link className="research-proof-link" href="/evidence#evaluation">
                <span className="research-proof-fig tabular">
                  {billResults.summary.referee.check_kept_whole} of {billResults.summary.referee.all_cases}
                </span>
                <span>labeled bills routed so her check stays whole</span>
              </Link>
            </li>
          </ul>
        </div>
        <details id="evidence-more" className="ev-more">
          <summary>ABLE figures, the sample year month by month, and all {RESEARCH.length} sources</summary>
          <div className="ev-more-body">
            <ul className="reach-list">
              {REACH.slice(2).map((r) => (
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
                  Sample household, {HELP_SPAN}: {usd(HELP_TOTAL)} of help from {new Set(sampleYear.gifts.map((g) => g.giver)).size} people, every gift through Giftwise. Her check stayed $994 every month.
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

      {/* For developers, and how it is built: side by side on a wide screen */}
      <div className="section frame dev-built">
        <section className="dev" aria-labelledby="dev-title">
          <h2 id="dev-title" className="section-title">
            Make any gift benefit-safe
          </h2>
          <p className="lede">One API call, or add the Giftwise MCP server to your AI agent.</p>
          <div className="hero-actions">
            <Link href="/developers" className="btn btn-primary">
              Get an API key
            </Link>
            <Link href="/developers/docs" className="text-link">
              Read the docs
            </Link>
          </div>
          <div className="dev-code" data-ui>
            <pre>
              <code>{`POST /api/v1/check-gift
Authorization: Bearer gw_test_...
{ "gift": { "amount": 1000, "delivery": "cash" } }

200 OK
{ "data": {
    "check_after": 74.00,
    "best_route": "item",
    "check_with_best_route": 994.00,
    "rule_ids": ["R-CASH-01", "R-INFREQ-01", "R-GIE-01"]
} }`}</code>
            </pre>
          </div>
        </section>

        <section className="built" aria-labelledby="built-title">
          <h2 id="built-title" className="section-title">
            How it is built
          </h2>
          <ul className="built-list">
            {BUILT.map((b) => (
              <li key={b.id} className="built-row">
                <span className="built-tool">
                  <Link href={`/stack#${b.id}`} className="rules-link">
                    {b.tool}
                  </Link>
                </span>
                <span className="built-job">{b.job}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

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
      {/* A link to anything inside the evidence disclosure opens it first. */}
      <OpenOnHash />
    </>
  );
}
