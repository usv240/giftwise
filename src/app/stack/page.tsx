import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "@/components/Info";
import { OpenOnHash } from "@/components/OpenOnHash";
import "../pages.css";
import "../developers/dev.css";
import "../learn/disclosure.css";
import "./stack.css";

export const metadata: Metadata = { title: "How it is built", description: "Every tool in Giftwise, the one job it does, and where it lives in the code." };

const REPO = "https://github.com/usv240/giftwise/blob/main/";

type Tool = { id: string; name: string; job: string; how: string; files: string[] };

const TOOLS: Tool[] = [
  {
    id: "paypal",
    name: "PayPal",
    job: "Moves the money: the donor pays the shop, the clinic or her ABLE account directly, never her and never Giftwise.",
    how: "Orders v2 with a payee on each purchase unit, so one checkout pays several recipients. PayPal JavaScript SDK v6 buttons, server-side capture with PayPal-Request-Id idempotency, approval links that capture on return, Payouts batches for funds reconciled with Transaction Search and the Balances API, signature-verified webhooks, and sandbox negative testing for the failure cases.",
    files: ["src/lib/paypal/orders.ts", "src/lib/paypal/capture.ts", "src/lib/paypal/payouts.ts", "src/lib/paypal/reporting.ts", "src/app/api/paypal/webhook/route.ts", "src/components/gift/PayPalPay.tsx"],
  },
  {
    id: "claude",
    name: "Claude Opus 5.5",
    job: "Reads bills, quotes and fundraiser pages, and explains each decision in plain words.",
    how: "claude-opus-5-5 with adaptive thinking, vision and structured outputs validated by Zod, with server-side fallbacks. It never does the benefit math: the rules engine does.",
    files: ["src/lib/ai/claude.ts", "src/lib/ai/tasks.ts", "src/app/api/v1/read-bill/route.ts"],
  },
  {
    id: "ag-studio",
    name: "AG Studio",
    job: "The dashboard of Maya's year: every gift, how it reached her, and her check each month compared with cash.",
    how: "ag-studio-react 3.0 with gifts and months data sources on a shared calendar, a theme built from the site tokens, a custom widget that runs the rules engine on whatever the filters leave in view, and the Studio Agent Framework running on Claude through our own adapter, with the rules engine as an extra tool.",
    files: ["src/components/dashboard/FamilyStudio.tsx", "src/components/dashboard/CheckWidget.tsx", "src/components/dashboard/studioAi.ts", "src/lib/studio-ai/translate.ts"],
  },
  {
    id: "render",
    name: "Render",
    job: "Hosts the site and its Postgres database, and checks the live demo from outside every night with Render Workflows.",
    how: "A web service, a managed Postgres database, a Render Workflow and a cron job, all in one render.yaml. The workflow fans out one task per check (each failure case against the PayPal sandbox, each page on the product path, each public API promise) with retries, and files the run with the app; the cron job starts it nightly with the Render SDK, and /evidence can start it on demand.",
    files: ["render.yaml", "workflows/src/main.ts", "workflows/src/checks.ts", "src/app/api/checks/start/route.ts", "src/app/api/ops/monthly/route.ts"],
  },
  {
    id: "render-jobs",
    name: "Render Workflows: background jobs",
    job: "Plans every monthly gift on the 1st, and rebuilds the rulebook's search index each week.",
    how: "monthlyRun fans out one planMonthly task per active monthly gift, each with its own retries, so every giver's page already shows that month's split and what changed; rulebookIndex rebuilds the Elastic index from the rule files. The nightly cron starts them on the 1st and on Sundays. The workflow calls the app with CHECKS_SECRET and handles gift ids, never givers' private links.",
    files: ["workflows/src/main.ts", "workflows/src/trigger.ts", "src/app/api/ops/monthly/[id]/plan/route.ts", "src/app/api/ops/rulebook/route.ts"],
  },
  {
    id: "channel3",
    name: "Channel3",
    job: "The gift finder: real products for a need, each checked against the SSI rules before it can go on a page.",
    how: "POST /v1/search (in stock, with a price cap) from the organizer's view and the find_gift MCP tool. Giftwise maps each product's category to the rules, runs the rules engine on it paid straight to the retailer, and holds back gift cards, which SSA counts like cash when they can buy food or shelter. Without a key, a sample catalog on .example domains stands in.",
    files: ["src/lib/channel3.ts", "src/app/api/manage/[token]/find/route.ts", "src/components/manage/ManageClient.tsx"],
  },
  {
    id: "elastic",
    name: "Elasticsearch",
    job: "Ask the rulebook: finds the passages that answer a question about SSI and gifts.",
    how: "Hybrid retrieval over the regulations, SSA's operating manual, its worked examples and the rule table: multi_match plus a semantic query on a semantic_text field with jina-embeddings-v3, fused by reciprocal rank (RRF), then the top 20 reranked by jina-reranker-v3. Claude answers from only those passages and a program checks every quote word for word. Without Elastic, an in-app BM25 ranking stands in.",
    files: ["src/lib/rulebook.ts", "src/app/api/v1/ask-rules/route.ts", "src/components/learn/AskRulebook.tsx"],
  },
  {
    id: "postman",
    name: "Postman",
    job: "The Giftwise API as a collection anyone can import and run.",
    how: "16 requests in five folders, each with tests: gift checks, a quarter's exclusions, the report and the page that checks it, the rulebook, the MCP server and its discovery documents. The same collection runs in the test suite with Newman.",
    files: ["scripts/postman-collection.mjs", "scripts/run-postman.mjs", "postman/giftwise.postman_collection.json"],
  },
  {
    id: "zapier",
    name: "Zapier",
    job: "Tells the family the moment a gift arrives.",
    how: "Each PayPal capture posts a signed gift.received event to the organizer's webhook. A Zapier Catch Hook turns it into a text, an email, a Slack message or a spreadsheet row, with no code. HMAC-SHA256 signatures with a timestamp; private network addresses are refused.",
    files: ["src/lib/manage.ts", "src/app/api/manage/[token]/webhook/route.ts"],
  },
  {
    id: "bryntum",
    name: "Bryntum Calendar",
    job: "Maya's benefit calendar: each gift on the day it arrived, each report to Social Security on its due date, and the check each 1st of the month pays.",
    how: "Bryntum Calendar 7.3 (trial) in month view. Dragging a gift to another day reruns the rules engine in the browser and lists which checks changed; a form does the same without dragging. A planner agent moves cash gifts on the calendar itself, by up to a week, so more of each falls under SSI's monthly and quarterly exclusions, and never into a month with no check. The light or dark Bryntum theme is loaded to match the site.",
    files: ["src/components/calendar/BenefitCalendar.tsx", "src/lib/calendar/model.ts", "src/lib/calendar/schedule.ts", "src/app/vendor/bryntum/[file]/route.ts"],
  },
  {
    id: "apimatic",
    name: "APIMatic",
    job: "Generated the PayPal Server SDK that creates and reads Giftwise's orders.",
    how: "@paypal/paypal-server-sdk, generated by APIMatic, creates every order (one purchase unit and payee per recipient, with a PayPal-Request-Id) and reads orders back, with typed requests. Capture is plain REST in src/lib/paypal/capture.ts: it sends PayPal's negative-testing header for the failure cases and retries a 5xx with the same PayPal-Request-Id.",
    files: ["src/lib/paypal/client.ts", "src/lib/paypal/orders.ts"],
  },
];

/** Every PayPal API and tool Giftwise calls, read from the code: the call, its job here, and the file. */
const PAYPAL_APIS: { api: string; call: string; job: string; file: string }[] = [
  { api: "OAuth 2.0", call: "POST /v1/oauth2/token", job: "One cached access token for every call below.", file: "src/lib/paypal/client.ts" },
  { api: "Orders v2: create", call: "POST /v2/checkout/orders", job: "One order with a purchase unit and payee for each recipient, through the APIMatic-generated Server SDK.", file: "src/lib/paypal/orders.ts" },
  { api: "Orders v2: capture", call: "POST /v2/checkout/orders/{id}/capture", job: "Captures every payee once, with PayPal-Request-Id, so a double click cannot pay twice. Plain REST, so the failure cases can send PayPal's negative-testing header.", file: "src/lib/paypal/capture.ts" },
  { api: "Orders v2: show", call: "GET /v2/checkout/orders/{id}", job: "Check with PayPal now on every receipt, and the assistant's read of the order, through the APIMatic SDK and plain REST.", file: "src/lib/paypal/orders.ts" },
  { api: "Orders v2: confirm payment source", call: "POST /v2/checkout/orders/{id}/confirm-payment-source", job: "Pays with a sandbox test card in the failure cases and in the nightly check that pays a gift split across its payees, standing in for the giver.", file: "src/lib/card-check.ts" },
  { api: "Payments v2: refund", call: "POST /v2/payments/captures/{id}/refund", job: "The refund failure case: PayPal lets only the shop send money back.", file: "src/lib/cases/scenarios.ts" },
  { api: "JavaScript SDK v6", call: "web-sdk/v6/core", job: "The PayPal button on each need and on Give any amount, and PayPal's guest Debit or Credit Card button where the SDK finds it eligible.", file: "src/components/gift/PayPalPay.tsx" },
  { api: "Payouts", call: "POST /v1/payments/payouts, GET /v1/payments/payouts/{id}", job: "A fund pays many households' needs in one batch.", file: "src/lib/paypal/payouts.ts" },
  { api: "Transaction Search", call: "GET /v1/reporting/transactions", job: "Confirms each payout in PayPal's own transaction report.", file: "src/lib/paypal/reporting.ts" },
  { api: "Balances", call: "GET /v1/reporting/balances", job: "Shows the fund's PayPal balance before it sends a batch.", file: "src/lib/paypal/reporting.ts" },
  { api: "Webhooks", call: "POST /v1/notifications/verify-webhook-signature", job: "Captures a payment if the giver never comes back, after checking PayPal's signature.", file: "src/app/api/paypal/webhook/route.ts" },
  { api: "Negative testing", call: "PayPal-Mock-Response header", job: "Makes the sandbox decline on purpose, for the failure cases.", file: "src/lib/paypal/capture.ts" },
  { api: "PayPal MCP server", call: "@paypal/mcp over stdio, tool get_order", job: "Reads orders back from PayPal itself, twice: the assistant on /agents reads each checkout it starts before June approves it, and the nightly card check reads every gift it pays to confirm each capture, amount and payee. Giftwise runs PayPal's own server package; PayPal's hosted server is the second choice. If neither answers, the Orders API does, and the page says which one did.", file: "src/lib/agent/paypal-mcp.ts" },
];

/** A short name for a file link: its last two path parts, plus the folder above when that part is src or a [param]. */
function shortPath(file: string) {
  const parts = file.split("/");
  let n = Math.min(2, parts.length);
  while (n < parts.length && /^(src|\[.+\])$/.test(parts[parts.length - n])) n++;
  return parts.slice(-n).join("/");
}

function FileLink({ file }: { file: string }) {
  return (
    <a className="stack-file" href={REPO + file} target="_blank" rel="noreferrer" title={file}>
      {shortPath(file)}
    </a>
  );
}

export default function StackPage() {
  return (
    <div className="page frame stack">
      <header className="page-head">
        <div className="title-row">
          <h1 className="page-title">How it is built</h1>
        </div>
        <p className="lede">
          Every tool in Giftwise, the one job it does, and where it lives in the code. Live status is on the{" "}
          <Link className="text-link" href="/status">
            Status page
          </Link>
          .
        </p>
        <nav className="stack-jump" aria-label="Tools on this page">
          <ul>
            {TOOLS.map((t) => (
              <li key={t.id}>
                <a className="text-link" href={`#${t.id}`}>
                  {t.name}
                </a>
              </li>
            ))}
            <li>
              <a className="text-link" href="#paypal-apis-all">
                Every PayPal API
              </a>
            </li>
          </ul>
        </nav>
      </header>
      <ul className="stack-list">
        {TOOLS.map((t) => (
          <li key={t.id} id={t.id} className="stack-row">
            <span className="stack-tool">
              {t.name} <Info id={`stack.${t.id}`} label="" />
            </span>
            <p className="stack-job">{t.job}</p>
            <details className="dsc stack-more">
              <summary>
                <span className="dsc-k">How it works and where it lives</span>
              </summary>
              <p className="stack-how">{t.how}</p>
              {t.files.length > 0 && (
                <p className="stack-files">
                  {t.files.map((f) => (
                    <FileLink key={f} file={f} />
                  ))}
                </p>
              )}
            </details>
          </li>
        ))}
      </ul>

      <section id="paypal-apis" className="page-section" aria-labelledby="pp-apis-h">
        <div className="title-row">
          <h2 id="pp-apis-h">Every PayPal API Giftwise calls</h2>
          <Info id="stack.paypal_apis" label="" />
        </div>
        <p className="page-prose">
          {PAYPAL_APIS.length} PayPal APIs and tools, each with one job. All run against the PayPal sandbox. PAYPAL_ENV=live moves the REST API, the JavaScript SDK and PayPal&rsquo;s MCP server together (src/lib/paypal/env.ts), with the live app&rsquo;s keys. Each shop then joins through PayPal&rsquo;s Partner Referrals and is paid by its merchant ID in src/lib/paypal/orders.ts; this sandbox app gets 403 NOT_AUTHORIZED from Partner Referrals until PayPal approves it as a partner, so the demo pays each shop by email address.
        </p>
        <details id="paypal-apis-all" className="dsc pp-apis">
          <summary>
            <span className="dsc-k">All {PAYPAL_APIS.length} PayPal APIs and tools, with the call and the file for each</span>
          </summary>
          <div className="doc-table-wrap" tabIndex={0} role="region" aria-label="PayPal APIs Giftwise calls">
            <table className="doc-table pp-apis-table">
              <thead>
                <tr>
                  <th scope="col">PayPal</th>
                  <th scope="col">Call</th>
                  <th scope="col">What it does here</th>
                  <th scope="col">Where</th>
                </tr>
              </thead>
              <tbody>
                {PAYPAL_APIS.map((a) => (
                  <tr key={a.api}>
                    <td>{a.api}</td>
                    <td>
                      <code>{a.call}</code>
                    </td>
                    <td>{a.job}</td>
                    <td>
                      <FileLink file={a.file} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <OpenOnHash />
    </div>
  );
}
