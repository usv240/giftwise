// Every page and public endpoint of a running Giftwise answers, with the content it should carry. Needs only a database:
// with no PayPal, Claude, Channel3 or Elastic keys, each one should fall back and say so, not fail. CI runs this on a
// fresh build against an empty Postgres. Usage: BASE_URL=http://localhost:3100 npm run e2e:smoke
const B = process.env.BASE_URL ?? "http://localhost:3100";
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
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
  ["/judges", "Giftwise"],
  ["/agents", "MCP"],
  ["/dashboard", "Giftwise"],
  ["/organizations", "Giftwise"],
  ["/developers", "API"],
  ["/developers/docs", "API"],
  ["/status", "PayPal"],
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

const head = await fetch(B + "/");
check("security headers", Boolean(head.headers.get("strict-transport-security") && head.headers.get("x-content-type-options") && head.headers.get("content-security-policy")));

console.log(failed ? `\n${failed} checks failed` : "\nall smoke checks pass");
process.exitCode = failed ? 1 : 0;
