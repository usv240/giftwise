import type { Metadata } from "next";
import { Info } from "@/components/Info";
import { DevConsole } from "@/components/developers/DevConsole";
import { LIMITS } from "@/lib/api/keys";
import "../pages.css";
import "./dev.css";

export const metadata: Metadata = { title: "Developers", description: "Add benefit-safe giving checks to your own product: free sandbox keys, a live playground and docs." };

const USES = [
  { who: "Giving and fundraising platforms", what: "Check a gift before it is sent, and suggest the benefit-safe way to give it." },
  { who: "ABLE programs and caseworker tools", what: "Plan a month of gifts and see which ones change the check, with sources a counselor can verify." },
  { who: "AI agents", what: "Connect the Giftwise MCP server and check before buying for someone on SSI. Answers are structured and cite the rule. See For AI agents." },
];

export default function DevelopersPage() {
  return (
    <div className="page frame developers">
      <header className="page-head">
        <div className="title-row">
          <h1 className="page-title">Developers</h1>
          <Info id="page.developers" />
        </div>
        <p className="lede">Add benefit-safe giving checks to your own product. Free sandbox keys, a live playground, and docs generated from the same schemas the API checks every request against.</p>
      </header>

      <ul className="dev-uses">
        {USES.map((u) => (
          <li key={u.who} className="dev-use">
            <p className="dev-use-who">{u.who}</p>
            <p>{u.what}</p>
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
    </div>
  );
}
