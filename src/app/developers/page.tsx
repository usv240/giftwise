import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "@/components/Info";
import { CopyButton } from "@/components/developers/CopyButton";
import { DevConsole } from "@/components/developers/DevConsole";
import { LIMITS } from "@/lib/api/keys";
import { HOSTED_URL } from "@/lib/origin";
import { DEFAULT_PROFILE, evaluateGift, usd } from "@/lib/rules";
import "../pages.css";
import "./dev.css";

export const metadata: Metadata = { title: "Developers", description: "Add benefit-safe giving checks to your own product: free sandbox keys, a live playground and docs." };

const HOST = (process.env.RENDER_EXTERNAL_URL || HOSTED_URL).replace(/\/$/, "");

/** The first call shown beside the lede: Uncle Joe's $1,000 in cash, with a fixed date so the answer never drifts. */
const FIRST = { gift: { amount: 1000, delivery: "cash", date: "2026-04-10" } } as const;
const FIRST_CURL = [
  `curl ${HOST}/api/v1/check-gift \\`,
  `  -H "Content-Type: application/json" \\`,
  `  -d '{"gift":{"amount":${FIRST.gift.amount},"delivery":"${FIRST.gift.delivery}",`,
  `       "date":"${FIRST.gift.date}"}}'`,
].join("\n");

const USES: { who: string; what: string; link?: { href: string; label: string } }[] = [
  { who: "Giving and fundraising platforms", what: "Check a gift before it is sent, and suggest the benefit-safe way to give it." },
  { who: "ABLE programs and caseworker tools", what: "Plan a month of gifts and see which ones change the check, with sources a counselor can verify." },
  { who: "AI agents", what: "Connect the Giftwise MCP server and check before buying for someone on SSI. Answers are structured and cite the rule.", link: { href: "/agents", label: "Connect an AI agent" } },
];

export default function DevelopersPage() {
  // Computed by the rules engine when the page is built, so the answer shown is the answer the API gives.
  const first = evaluateGift({ id: "first", category: "other", ...FIRST.gift }, DEFAULT_PROFILE);
  return (
    <div className="page frame developers">
      <div className="dev-hero">
        <header className="page-head">
          <div className="title-row">
            <h1 className="page-title">Developers</h1>
            <Info id="page.developers" />
          </div>
          <p className="lede">Add benefit-safe giving checks to your own product. Free sandbox keys, a live playground, and docs generated from the same schemas the API checks every request against.</p>
        </header>
        <figure className="dev-first" data-ui>
          <div className="dev-first-head">
            <figcaption>First call: check a gift</figcaption>
            <CopyButton text={FIRST_CURL} label="Copy" />
          </div>
          <pre className="dev-pre tabular" tabIndex={0} aria-label="First call, in cURL">
            {FIRST_CURL}
          </pre>
          <p className="dev-first-note">
            It answers <code>check_after: {first.checkAfter}</code> and <code>best_route: &quot;{first.bestRoute}&quot;</code>: {usd(FIRST.gift.amount)} in cash would drop her check to {usd(first.checkAfter)}, and giving the item itself keeps all {usd(first.checkWithBestRoute)}.
          </p>
        </figure>
      </div>

      <ul className="dev-uses">
        {USES.map((u) => (
          <li key={u.who} className="dev-use">
            <p className="dev-use-who">{u.who}</p>
            <p>{u.what}</p>
            {u.link && (
              <p className="dev-use-link">
                <Link className="text-link" href={u.link.href}>
                  {u.link.label}
                </Link>
              </p>
            )}
          </li>
        ))}
        <li className="dev-use dev-limits">
          <p className="dev-use-who">Limits</p>
          <p className="tabular">
            With a key: {LIMITS.keyPerMinute} requests a minute, {LIMITS.keyPerDay.toLocaleString("en-US")} a day. Without: {LIMITS.demoPerMinute} a minute.
          </p>
        </li>
      </ul>

      <DevConsole />

      <p className="dev-source muted">
        <a className="text-link" href="https://github.com/usv240/giftwise">
          Source
        </a>
      </p>
    </div>
  );
}
