import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Info } from "@/components/Info";
import { MODE_LABEL, liveSummary, optionalOffSentence, statusChecks } from "@/lib/health";
import { CheckedAt } from "./CheckedAt";
import "../pages.css";
import "./status.css";

export const metadata: Metadata = { title: "Status", description: "Every service Giftwise uses, and whether it is live, using its fallback, or optional and off." };

/** The Info entry that explains each service, when it is not stack.<id>. */
const INFO: Record<string, string> = { database: "render", webhooks: "paypal", payees: "paypal", checks: "render", "paypal-mcp": "paypal_apis" };

type Search = { check?: string };

async function Rows({ searchParams }: { searchParams: Promise<Search> }) {
  await connection();
  const q = await searchParams;
  // One round of probes serves every visitor for a minute; "Check again" runs a new round now.
  const { checks, at } = await statusChecks({ fresh: q.check === "now" });
  // Optional services that are off are named, not counted: they are a choice, and nothing depends on them.
  const s = liveSummary(checks);
  const off = optionalOffSentence(s.optionalOff);
  return (
    <>
      <p className="status-sum">
        <span className="tabular">
          {s.live} of {s.of} services live, checked at <CheckedAt iso={at} />.
        </span>{" "}
        {off && <span className="muted">{off} </span>}
        <span className="muted">Each round of checks is kept for a minute. </span>
        <a className="text-link" href="/status?check=now">
          Check again now
        </a>
      </p>
      <ul className="status-list">
        {checks.map((c) => (
          <li key={c.id} className="status-row">
            <span className="status-name">
              {c.name} <Info id={`stack.${INFO[c.id] ?? c.id}`} label="" />
            </span>
            <span className="status-detail">
              {c.detail}
              {c.ms ? <span className="tabular"> in {c.ms} ms</span> : null}
            </span>
            <span className="status-mode" data-mode={c.mode}>
              {MODE_LABEL[c.mode]}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function StatusPage({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <div className="page frame">
      <header className="page-head">
        <div className="title-row">
          <h1 className="page-title">Status</h1>
          <Info id="page.status" />
        </div>
        <p className="lede">Every service Giftwise uses, checked live. The latest round of checks is shown at once and runs again after a minute. When a service is not reachable, Giftwise switches to its fallback so nothing breaks.</p>
        <p className="page-prose">
          For requests, errors, payments and a live event stream, see{" "}
          <Link className="text-link" href="/ops">
            Operations
          </Link>
          .
        </p>
      </header>
      <Suspense fallback={<p className="page-loading">Checking every service…</p>}>
        <Rows searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
