// Every page and public endpoint of a running Giftwise answers, with the content it should carry. Needs only a database:
// with no PayPal, Claude, Channel3 or Elastic keys, each one should fall back and say so, not fail. CI runs this on a
// fresh build against an empty Postgres. Usage: BASE_URL=http://localhost:3100 npm run e2e:smoke
import { readFileSync } from "node:fs";
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
  ["/evidence/rules", "How the rules were checked"],
  ["/evidence/operations", "Checked every night"],
  ["/evidence/impact", "Why not pay the shop yourself"],
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
check("health: every integration reports a mode", health.checks?.every((c) => ["live", "fallback", "not_connected", "off", "checking"].includes(c.mode)), health.checks?.map((c) => `${c.id}:${c.mode}`).join(" "));
// The count /status and /ops show comes from the same summary: optional services that are off are named, not counted.
check("health: the summary leaves optional services that are off out of the count", health.summary?.of === health.checks?.filter((c) => c.mode !== "off").length && health.checks?.filter((c) => c.mode === "off").every((c) => c.optional), JSON.stringify(health.summary));
// The PayPal MCP server line reads the same as on /status: the last check's answer with its time, never a placeholder.
const mcpLine = health.checks?.find((c) => c.id === "paypal-mcp");
check("health: the PayPal MCP server reports its last check and when it ran", mcpLine && (["checking", "not_connected"].includes(mcpLine.mode) || (Boolean(mcpLine.checkedAt) && /checked /.test(mcpLine.detail))), mcpLine && `${mcpLine.mode}: ${mcpLine.detail}`);

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
const robotsRes = await fetch(`${B}/robots.txt`);
const robotsTxt = await robotsRes.text();
check(
  "discovery: robots.txt keeps private links and the API out and names the sitemap",
  robotsRes.status === 200 && ["/manage/", "/m/", "/r/", "/v/", "/api/"].every((p) => robotsTxt.includes(`Disallow: ${p}`)) && /Sitemap: \S+\/sitemap\.xml/.test(robotsTxt),
  `${robotsRes.status}`,
);
const sitemapRes = await fetch(`${B}/sitemap.xml`);
const sitemapXml = await sitemapRes.text();
const locs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
check(
  "discovery: sitemap.xml lists the sample page and no private link",
  sitemapRes.status === 200 && locs.includes("/g/maya") && locs.includes("/evidence") && !locs.some((p) => /^\/(manage|m|r|v|api)\//.test(p)),
  `${sitemapRes.status} ${locs.length} urls`,
);

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
check("health: error tracking reports live, or optional and off", errors && ["live", "off"].includes(errors.mode) && errors.optional === true, errors?.detail);

const head = await fetch(B + "/");
check("security headers", Boolean(head.headers.get("strict-transport-security") && head.headers.get("x-content-type-options") && head.headers.get("content-security-policy")));

// The recorded assistant on /agents names the same two checks Maya's page computes for a $300 cash gift today.
const giftHtml = (await (await fetch(`${B}/g/maya`)).text()).replace(/<!-- -->/g, "");
const agentsHtml = await (await fetch(`${B}/agents`)).text();
const cashLine = /A \$300 cash gift would lower her \w+ \d{4} check to (\$[\d,]+)\. Paying for one of these needs instead keeps her full \w+ \d{4} check of (\$[\d,]+)/.exec(giftHtml);
check("/agents and /g/maya name the same checks for $300 in cash", Boolean(cashLine) && agentsHtml.includes(cashLine[1]) && agentsHtml.includes(cashLine[2]), cashLine ? `${cashLine[2]} and ${cashLine[1]}` : "no cash line on /g/maya");

// Every full check a page states carries its year ($994 in 2026, $1,029 from January 2027): in the same sentence, or, for
// a recorded run or a page of API examples, in the year note its container (data-check-year) opens with.
{
  const FULL = /\$(994|1,029|1,491|1,544)(?![\d,])(?!\.\d)/;
  const text = (html) =>
    html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ")
      .replace(/<!-- -->/g, "")
      .replace(/<(br|\/p|\/li|\/h\d|\/dd|\/dt|\/td|\/th|\/div|\/summary|\/figcaption|\/pre)[^>]*>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&rsquo;|&#x27;|&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"');
  const NOTE = /full amount is \$[\d,]+|\$994 in 2026, \$1,029 from January 2027/;
  for (const [path] of pages) {
    const html = await (await fetch(B + path)).text();
    const bad = /data-check-year/.test(html)
      ? NOTE.test(text(html))
        ? []
        : ["the page's year note is missing"]
      : text(html)
          .split(/\n+/)
          .map((l) => l.trim())
          .filter(Boolean)
          // A figure alone on its line reads with its label and the heading of its small group just above it ("Her
          // January 2027 check", then "As cash $0", "With Giftwise $1,029"), so one of those lines carries the year.
          .flatMap((l, i, all) => (/^\$[\d,.]+$/.test(l) ? (FULL.test(l) ? [`${all.slice(Math.max(0, i - 4), i).join(" ")} ${l}`] : []) : l.split(/(?<=[.!?])\s+/)))
          .filter((s) => FULL.test(s) && !/\b20(2[6-9])\b/.test(s));
    check(`page ${path} names the year of every full check it states`, bad.length === 0, bad.slice(0, 2).join(" | ").slice(0, 200));
  }
}

// The organizer's page is complete in the HTML itself: the needs are there before any client script runs.
{
  const html = await (await fetch(`${B}/manage/maya-sample-organizer`)).text();
  check("the organizer's page renders its needs on the server, not a loading line", html.includes("Wheelchair repair") && !html.includes("Loading the page"), `${html.length} bytes`);
}

// The recorded sandbox receipt is seeded with the sample page, so it opens on any deployment without paying.
{
  const recorded = JSON.parse(readFileSync("content/sample-receipt.json", "utf8"));
  const r = await fetch(`${B}/r/${recorded.order_id}`);
  const html = await r.text();
  check("the recorded sample receipt opens, labelled as recorded, with every line", r.status === 200 && html.includes("rc-total") && html.includes("data-recorded") && recorded.lines.every((l) => html.includes(l.capture_id)), `${r.status}`);
}

// Every script the gift page asks the browser for is served: a build whose client chunks are missing (a stale server
// after a deploy) answers 200 for the page and 404 for the chunk, and the PayPal buttons never appear.
{
  const html = await (await fetch(`${B}/g/maya`)).text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]).filter((s) => s.startsWith("/"));
  const statuses = await Promise.all(scripts.map(async (s) => [s, (await fetch(B + s)).status]));
  const missing = statuses.filter(([, st]) => st !== 200);
  check("every client script the gift page names is served", scripts.length > 0 && missing.length === 0, missing.length ? missing.map(([s, st]) => `${st} ${s}`).join(", ") : `${scripts.length} scripts`);
}

// In a real browser, the PayPal button on Maya's page becomes visible; with no PayPal client id on the server, the
// page says so instead. A page that keeps "Loading PayPal" with neither is the failure this catches.
{
  const paypalLive = health.checks?.find((c) => c.id === "paypal")?.mode === "live";
  let outcome = "";
  try {
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 120)));
    await page.goto(`${B}/g/maya`, { waitUntil: "domcontentloaded" });
    // Wake the buttons the way a person does (they load at the first sign of one), then wait for either outcome.
    await page.mouse.move(200, 300);
    outcome = await page
      .waitForFunction(() => (document.querySelector("paypal-button:not([hidden])") ? "button" : document.querySelector(".pp-note") ? "unavailable" : null), null, { timeout: 30000 })
      .then((h) => h.jsonValue())
      .catch(() => `neither (${pageErrors[0] ?? "no page error"})`);
    await browser.close();
  } catch (e) {
    outcome = `no browser: ${e.message.slice(0, 80)}`;
  }
  check(
    paypalLive ? "the PayPal button on Maya's page becomes visible in a browser" : "Maya's page says PayPal is not connected, with no client id on this server",
    paypalLive ? outcome === "button" : outcome === "unavailable" || outcome === "button",
    outcome,
  );
}

console.log(`\n${total - failed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
