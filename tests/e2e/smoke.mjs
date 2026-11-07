// Every page and public endpoint of a running Giftwise answers, with the content it should carry. Needs only a database:
// with no PayPal, Claude, Channel3 or Elastic keys, each one should fall back and say so, not fail. CI runs this on a
// fresh build against an empty Postgres. Usage: BASE_URL=http://localhost:3100 npm run e2e:smoke
const B = process.env.BASE_URL ?? "http://localhost:3100";
let failed = 0;
let total = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
  total++;
  if (!ok) failed++;
};

const pages = [
  ["/", "Giftwise"],
  ["/try", "SSI"],
  ["/learn", "rulebook"],
  ["/g/maya", "Maya"],
  ["/g/maya?lang=es", "Maya"],
  ["/g/maya/report?month=2026-10", "Maya"],
  ["/g/maya/report/easy?month=2026-10", "Easy Read"],
  ["/g/maya/calendar", "Maya"],
  ["/manage/maya-sample-organizer", "Maya"],
  ["/evidence", "Giftwise"],
  ["/evidence/ssa-examples", "worked examples"],
  ["/evidence/bills", "labeled bills"],
  ["/evidence/court-cases", "federal court"],
  ["/agents", "MCP"],
  ["/dashboard", "Giftwise"],
  ["/organizations", "Giftwise"],
  ["/developers", "API"],
  ["/developers/docs", "API"],
  ["/status", "PayPal"],
  ["/ops", "Operations"],
  ["/stack", "PayPal"],
  ["/about", "Giftwise"],
];
for (const [path, word] of pages) {
  const r = await fetch(B + path);
  const html = await r.text();
  check(`page ${path}`, r.status === 200 && html.includes(word), `${r.status}`);
}

const health = await (await fetch(`${B}/api/health`)).json();
const db = health.checks?.find((c) => c.id === "database");
check("health: the database is live", db?.mode === "live", db?.detail);
check("health: every integration reports a mode", health.checks?.every((c) => ["live", "fallback", "not_connected"].includes(c.mode)), health.checks?.map((c) => `${c.id}:${c.mode}`).join(" "));

// The rules engine needs no keys: $1,000 in cash in April 2026 leaves a $994 check at $74 (20 CFR 416.1123, 416.1124).
const gift = await fetch(`${B}/api/v1/check-gift`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gift: { amount: 1000, delivery: "cash", date: "2026-04-10" } }) });
const giftJ = await gift.json().catch(() => null);
check("API: check-gift works out the check", gift.status === 200 && giftJ?.data?.check_after === 74, `check_after ${giftJ?.data?.check_after}`);

const catalog = await fetch(`${B}/.well-known/ai-catalog.json`);
const cat = await catalog.json().catch(() => null);
check("discovery: AI catalog lists the MCP server", catalog.status === 200 && JSON.stringify(cat).includes("server-card"));
const card = await fetch(`${B}/api/mcp/server-card`);
check("discovery: MCP server card", card.status === 200 && (await card.json().catch(() => null))?.name !== undefined);
const llms = await fetch(`${B}/llms.txt`);
check("discovery: llms.txt", llms.status === 200 && (await llms.text()).includes("Giftwise"));

const ask = await fetch(`${B}/api/v1/ask-rules`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "Can my mom pay my rent?" }) });
const askJ = await ask.json().catch(() => null);
check("rulebook: answers with passages (Elasticsearch, or keyword search without it)", ask.status === 200 && (askJ?.data?.passages?.length ?? 0) > 0, `${ask.status} ${askJ?.data?.retrieval?.engine ?? ""}`);

// Every API answer carries a request id, in the header, in meta, and at the end of an error message; /ops can trace it.
const rid = gift.headers.get("x-request-id");
check("observability: x-request-id header matches meta.request_id", Boolean(rid) && giftJ?.meta?.request_id === rid, rid ?? "");
const bad = await fetch(`${B}/api/v1/check-gift`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
const badJ = await bad.json().catch(() => null);
check("observability: an error message ends with its request id", bad.status === 400 && badJ?.error?.message?.endsWith(`Request id: ${badJ?.meta?.request_id}`), badJ?.error?.message);
const traced = await (await fetch(`${B}/api/ops/trace?id=${rid}`)).json().catch(() => null);
check("observability: /api/ops/trace finds the request's log line", traced?.data?.requests?.some((r) => r.route === "/api/v1/check-gift"), JSON.stringify(traced?.data?.requests ?? "").slice(0, 120));
const feed = await (await fetch(`${B}/api/ops/feed`)).json().catch(() => null);
check("observability: /api/ops/feed carries no email or payee", Array.isArray(feed?.data?.events) && !/@|payee/i.test(JSON.stringify(feed.data.events)), `${feed?.data?.events?.length ?? 0} events`);
const errors = health.checks?.find((c) => c.id === "errors");
check("health: error tracking reports live or not connected", errors && ["live", "not_connected"].includes(errors.mode), errors?.detail);

const head = await fetch(B + "/");
check("security headers", Boolean(head.headers.get("strict-transport-security") && head.headers.get("x-content-type-options") && head.headers.get("content-security-policy")));

// The recorded assistant on /agents names the same two checks Maya's page computes for a $300 cash gift today.
const giftHtml = (await (await fetch(`${B}/g/maya`)).text()).replace(/<!-- -->/g, "");
const agentsHtml = await (await fetch(`${B}/agents`)).text();
const cashLine = /A \$300 cash gift would lower her check to (\$[\d,]+)\. Paying for one of these needs instead keeps her full (\$[\d,]+)/.exec(giftHtml);
check("/agents and /g/maya name the same checks for $300 in cash", Boolean(cashLine) && agentsHtml.includes(cashLine[1]) && agentsHtml.includes(cashLine[2]), cashLine ? `${cashLine[2]} and ${cashLine[1]}` : "no cash line on /g/maya");

console.log(`\n${total - failed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
