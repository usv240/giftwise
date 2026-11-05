import type { Metadata } from "next";
import Link from "next/link";
import glossary from "../../../content/glossary.json";
import sources from "../../../content/sources.json";
import { Info } from "@/components/Info";
import { AskRulebook } from "@/components/learn/AskRulebook";
import { DEFAULT_PROFILE, evaluateGift, usd, type Gift } from "@/lib/rules";
import "./learn.css";

export const metadata: Metadata = {
  title: "The rules, explained",
  description: "How Social Security counts gifts for people on SSI, in plain words, with worked examples and sources.",
};

const SRC = sources as Record<string, { title: string; url: string; publisher: string }>;

const g = (over: Partial<Gift>): Gift => ({ id: "learn", date: "2026-04-10", amount: 1000, delivery: "cash", category: "other", ...over });

type Topic = {
  id: string;
  title: string;
  plain: string[];
  technical: string;
  example?: { label: string; gift: Gift };
  sources: string[];
};

const TOPICS: Topic[] = [
  {
    id: "payment",
    title: "The monthly payment",
    plain: [
      "SSI pays one person up to $994 a month in 2026. A couple can receive up to $1,491.",
      "Some states add a small supplement. Giftwise uses the federal amount, so real checks can be a little higher.",
    ],
    technical: "Federal benefit rate (FBR), 2026 COLA. The engine reads it from content/facts.json, with a verified flag for each value.",
    sources: ["ssa-cola-2026"],
  },
  {
    id: "vendor-payments",
    title: "Paying a shop directly",
    plain: [
      "When someone pays a shop or service directly for something she needs, it is not her income. The check stays the same.",
      "This works for medical bills, equipment, repairs, phone, internet, clothing, transport and school costs. Housing is the one exception, explained below.",
    ],
    technical: "20 CFR 416.1103(g): payment of bills by someone else directly to the supplier is not income. POMS SI 00815.400, Example 2: a sister pays the phone bill.",
    example: { label: "Dan pays $420 to the wheelchair repair shop", gift: g({ amount: 420, delivery: "vendor", category: "equipment" }) },
    sources: ["cfr-416-1103-g", "poms-si-00815-400"],
  },
  {
    id: "exclusions",
    title: "Cash gifts and the two exclusions",
    plain: [
      "Cash or a check given to her counts as income in the month it arrives.",
      "Two small exclusions apply first. The first $60 a quarter of one-off income is not counted, and the first $20 of income each month is not counted.",
      "So a single $1,000 cash gift leaves $920 counted, and her check drops to $74.",
    ],
    technical: "R-CASH-01, R-INFREQ-01, R-GIE-01. Since July 2004 the infrequent or irregular exclusion removes the first $60 even when the quarter's total is higher (POMS SI 00810.410 B.2). A gift is infrequent when the same giver gives once a quarter and not in the months either side.",
    example: { label: "Uncle Joe sends $1,000 cash", gift: g({}) },
    sources: ["poms-si-00830-520", "poms-si-00810-410", "poms-si-00810-420"],
  },
  {
    id: "housing",
    title: "Help with rent and utilities",
    plain: [
      "When someone else pays her rent, mortgage, property tax or utilities, Social Security counts it as housing support.",
      "It lowers the check by at most $351.33 a month in 2026. Giftwise routes this help through her ABLE account instead, so she pays the bill herself and keeps her full check.",
    ],
    technical: "In-kind support and maintenance (ISM), shelter only. Valued at the lesser of actual amount or the presumed maximum value ($351.33). If she lives in another person's home all month without paying her share, the one-third reduction ($331.33) applies instead.",
    example: { label: "Dan pays her $800 rent every month", gift: g({ amount: 800, delivery: "vendor", category: "rent", recurring: true }) },
    sources: ["cfr-416-1130", "poms-si-00835-350", "poms-si-00835-360", "poms-si-00835-901"],
  },
  {
    id: "food",
    title: "Food is no longer counted",
    plain: [
      "Since September 30, 2024, food paid for by others does not lower the check.",
      "Some older examples in Social Security's manual still show food being counted. Giftwise always applies the newer rule.",
    ],
    technical: "89 FR 21199 removed food from ISM effective 2024-09-30. POMS SI 00815.400 Example 1 (dated 2005) predates it; the regulation takes precedence.",
    example: { label: "A friend pays for $150 of grocery delivery", gift: g({ amount: 150, delivery: "vendor", category: "food" }) },
    sources: ["fr-89-21199"],
  },
  {
    id: "able",
    title: "ABLE accounts",
    plain: [
      "An ABLE account is a savings account for people whose disability began before age 46. Since January 2026, about 6 million more people can open one.",
      "Money that others put into it is not her income. The first $100,000 in it does not count toward the $2,000 savings limit. Up to $20,000 a year can go in.",
    ],
    technical: "POMS SI 01130.740. Housing withdrawals are not income when spent in the month received; kept past that month, they count toward savings.",
    example: { label: "Dan sends $800 for rent to her ABLE account", gift: g({ amount: 800, delivery: "able", category: "rent" }) },
    sources: ["poms-si-01130-740", "ssa-spotlight-able-2026", "able-nrc-age-adjustment"],
  },
  {
    id: "education",
    title: "School costs",
    plain: ["A gift used for tuition, fees, books, supplies or school technology is not counted. Keep the receipts."],
    technical: "POMS SI 00830.455 (grants, scholarships, fellowships and gifts used for educational expenses).",
    example: { label: "Aunt June buys her laptop for college", gift: g({ amount: 649, delivery: "vendor", category: "education" }) },
    sources: ["poms-si-00830-455"],
  },
  {
    id: "items",
    title: "Giving the item itself",
    plain: ["Giving her a thing she uses, such as a chair or a laptop, instead of money, is not counted as income."],
    technical: "Receipt of a noncash item that would be an excluded resource (household goods and personal effects) is not income. Items bought as investments are an exception.",
    example: { label: "Uncle Joe buys the shower chair on her list", gift: g({ amount: 289, delivery: "item", category: "personal" }) },
    sources: ["poms-si-01130-430", "cfr-416-1103-g"],
  },
  {
    id: "savings",
    title: "The $2,000 savings limit",
    plain: [
      "Her countable savings must be $2,000 or less at the start of each month ($3,000 for a couple). It has been $2,000 since 1989.",
      "Cash kept past the end of the month it arrived starts counting as savings. Giftwise warns before the 1st.",
    ],
    technical: "POMS SI 01110.003 and SI 01110.600 (income in the month of receipt, a resource from the first of the next month).",
    sources: ["poms-si-01110-003", "poms-si-01110-600"],
  },
  {
    id: "timing",
    title: "Why changes come two months later",
    plain: ["Social Security looks back two months. Income counted in April changes the June check."],
    technical: "Retrospective monthly accounting, POMS SI 02005.001. Engine: payment month = income month + 2.",
    sources: ["poms-si-02005-001"],
  },
];

export default function LearnPage() {
  return (
    <div className="learn frame">
      <header className="learn-head">
        <div className="title-row">
          <h1 className="learn-title">The rules, explained</h1>
          <Info id="page.learn" />
        </div>
        <p className="lede">
          How Social Security counts gifts for people on SSI. Each rule has a worked example and links to its source. Switch to Technical in the View menu for rule numbers and details.
        </p>
        <AskRulebook />
      </header>

      <div className="learn-body">
        <nav className="learn-toc" aria-label="On this page">
          <p className="muted">On this page</p>
          <ul>
            {TOPICS.map((t) => (
              <li key={t.id}>
                <a href={`#${t.id}`}>{t.title}</a>
              </li>
            ))}
            <li>
              <a href="#glossary">Glossary</a>
            </li>
            <li>
              <a href="#sources">Sources</a>
            </li>
          </ul>
        </nav>

        <div className="learn-main">
          {TOPICS.map((t) => {
            const r = t.example ? evaluateGift(t.example.gift, DEFAULT_PROFILE) : null;
            return (
              <section key={t.id} id={t.id} className="topic" aria-labelledby={`${t.id}-h`}>
                <h2 id={`${t.id}-h`} className="topic-title">
                  {t.title}
                </h2>
                {t.plain.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
                <p className="tech-only">{t.technical}</p>
                {r && t.example && (
                  <div className="example" data-ui>
                    <p className="example-label">{t.example.label}</p>
                    <p className="example-figure tabular">
                      June check: <strong>{usd(r.checkAfter)}</strong>
                    </p>
                    <p className="example-note">{r.explanation.plain}</p>
                  </div>
                )}
                <p className="topic-sources">
                  Sources:{" "}
                  {t.sources.map((k, i) => (
                    <span key={k}>
                      <a className="text-link" href={SRC[k].url} target="_blank" rel="noreferrer">
                        {SRC[k].title.split(":")[0]}
                      </a>
                      {i < t.sources.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
              </section>
            );
          })}

          <section id="glossary" className="topic" aria-labelledby="glossary-h">
            <h2 id="glossary-h" className="topic-title">
              Glossary
            </h2>
            <dl className="glossary">
              {glossary.map((gl) => (
                <div key={gl.term} className="gloss-row">
                  <dt>{gl.term}</dt>
                  <dd>
                    {gl.plain}
                    <span className="tech-only"> {gl.technical}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="sources" className="topic" aria-labelledby="sources-h">
            <h2 id="sources-h" className="topic-title">
              Sources
            </h2>
            <p>Every rule, number and claim on this site comes from one of these documents.</p>
            <ul className="source-list">
              {Object.entries(SRC).map(([k, s]) => (
                <li key={k}>
                  <a className="text-link" href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                  <span className="muted"> {s.publisher}</span>
                </li>
              ))}
            </ul>
            <p className="muted">
              Giftwise gives guidance based on published rules, with sources, and is not legal advice. For complex situations, a benefits counselor can help.{" "}
              <Link href="/about" className="text-link">
                About Giftwise
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
