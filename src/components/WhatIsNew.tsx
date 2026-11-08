import Link from "next/link";
import bills from "../../content/eval-results.json";

/**
 * The three things no other way of giving does, in the same words on the home page and the Evidence page: a report to
 * Social Security anyone can check against PayPal, a referee in code over two reviewers with different rulebooks, and
 * an AI assistant that asks before a gift is given.
 */
const NEW = [
  {
    k: "A report anyone can check",
    v: "PayPal pays only the payees the rules picked, in one order captured once, so every gift has a PayPal record. Each month's report to Social Security carries a code and a QR code: opening it rebuilds the report, asks PayPal live for every payment in it and checks the audit ledger, with no login.",
    href: "/g/maya/report?month=2026-10#rp-verify-h",
    link: "October's report",
  },
  {
    k: "Two rulebooks, and a referee in code",
    v: `When a bill might be a housing cost, two Claude reviewers read different rulebooks and must quote them word for word. Code checks every quote, takes a reading only when both agree, and otherwise picks the route that keeps her check whole either way: ${bills.summary.referee.check_kept_whole} of ${bills.summary.referee.all_cases} labeled bills.`,
    href: "/evidence/rules#referee",
    link: "One bill, two reviewers",
  },
  {
    k: "An AI assistant that asks first",
    v: "Over MCP, an assistant checks a gift before it is given and starts a PayPal checkout that only the giver can approve, then reads the order back from PayPal's own MCP server.",
    href: "/agents",
    link: "Watch it talk June out of cash",
  },
] as const;

export function WhatIsNew({ headingId, className }: { headingId: string; className?: string }) {
  return (
    <section className={`new3 ${className ?? ""}`} aria-labelledby={headingId}>
      <h2 id={headingId} className="new3-h">
        What is new
      </h2>
      <ul className="new3-list">
        {NEW.map((n) => (
          <li key={n.k} className="new3-item" data-ui>
            <p className="new3-k">{n.k}</p>
            <p className="new3-v">{n.v}</p>
            <Link className="text-link new3-link" href={n.href}>
              {n.link}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
