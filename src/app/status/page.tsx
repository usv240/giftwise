import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Info } from "@/components/Info";
import { runChecks } from "@/lib/health";
import "../pages.css";

export const metadata: Metadata = { title: "Status", description: "Every service Giftwise uses, and whether it is live or using its fallback." };

const LABEL = { live: "Live", fallback: "Fallback", not_connected: "Not connected" } as const;

async function Rows() {
  await connection();
  const checks = await runChecks({ probeMcp: true });
  return (
    <ul className="status-list">
      {checks.map((c) => (
        <li key={c.id} className="status-row">
          <span className="status-name">
            {c.name} <Info id={`stack.${({ database: "render", webhooks: "paypal", checks: "render", "paypal-mcp": "paypal_apis" } as Record<string, string>)[c.id] ?? c.id}`} label="" />
          </span>
          <span className="status-detail">{c.detail}</span>
          <span className="status-mode" data-mode={c.mode}>
            {LABEL[c.mode]}
            {c.ms ? <span className="tabular"> {c.ms} ms</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function StatusPage() {
  return (
    <div className="page frame">
      <header className="page-head">
        <div className="title-row">
          <h1 className="page-title">Status</h1>
          <Info id="page.status" />
        </div>
        <p className="lede">Every service Giftwise uses, checked live when you open this page. When a service is not reachable, Giftwise switches to its fallback so nothing breaks.</p>
      </header>
      <Suspense fallback={<p className="page-loading">Checking every service…</p>}>
        <Rows />
      </Suspense>
    </div>
  );
}
