"use client";

import { useState } from "react";

/** The bill counts come from content/eval-results.json (passed in by the page), so this answer matches For judges. */
const faqs = (bills: number, kept: number) => [
  {
    q: "Is this legal advice?",
    a: "Giftwise explains Social Security's published rules and shows the source for every answer. For complex situations, such as couples or state programs, tap Ask a counselor to share the case with a benefits counselor.",
  },
  {
    q: "Who can use it?",
    a: "Anyone helping a person who receives SSI in the United States. It runs in PayPal's sandbox today, so you can try every step safely.",
  },
  {
    q: "Why pay the shop instead of giving cash?",
    a: "Social Security counts cash gifts as income for the month they arrive. A payment made straight to a shop for something she needs, other than housing, is not counted (20 CFR 416.1103(g)).",
  },
  {
    q: "What about rent and utilities?",
    a: "Help with rent or utilities counts as housing support, up to $351.33 a month in 2026. Giftwise routes it through her ABLE account instead, so she pays the bill herself and keeps her full check.",
  },
  {
    q: "What is an ABLE account?",
    a: "A tax-advantaged savings account for people whose disability began before age 46 (since January 2026). The first $100,000 in it does not count toward the $2,000 savings limit.",
  },
  {
    q: "Does Giftwise hold the money?",
    a: "No. Donors pay the shop or the ABLE account directly through PayPal. Giftwise never holds funds, so nothing sits in her savings.",
  },
  {
    q: "How do I know an answer is right?",
    a: `Every answer cites the rule. When a bill might be a housing cost, two AI reviewers each check it against a different rulebook and must quote it word for word, and fixed rules, not AI, do the money math. On ${bills} labeled bills, the two reviewers and the referee kept her check whole on ${kept === bills ? `all ${bills}` : kept}; every bill and answer is on the For judges page.`,
  },
  {
    q: "Can my app use this?",
    a: "Yes. Get a free sandbox API key on the Developers page, or add the Giftwise MCP server to your AI agent.",
  },
];

/** "Question index, one answer" from the direction sheet. On phones, answers open under their question. */
export function Faq({ bills, billsKeptWhole }: { bills: number; billsKeptWhole: number }) {
  const FAQS = faqs(bills, billsKeptWhole);
  const [sel, setSel] = useState(0);
  return (
    <div className="faq">
      <ul className="faq-list" aria-label="Questions">
        <li className="faq-head muted">Questions</li>
        {FAQS.map((f, i) => (
          <li key={f.q}>
            <button
              type="button"
              className="faq-q"
              aria-expanded={sel === i}
              aria-controls="faq-answer"
              data-on={sel === i ? "" : undefined}
              onClick={() => setSel(i)}
              onFocus={() => setSel(i)}
            >
              <span className="faq-dot" aria-hidden="true" />
              {f.q}
            </button>
            {sel === i && <p className="faq-a-inline">{f.a}</p>}
          </li>
        ))}
      </ul>
      <div className="faq-pane" id="faq-answer" aria-live="polite">
        <p key={sel} className="faq-a">
          {FAQS[sel].a}
        </p>
      </div>
    </div>
  );
}
