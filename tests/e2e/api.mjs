// End-to-end API checks against the running dev server. Prints PASS/FAIL lines only.
const B = process.env.BASE_URL ?? "http://localhost:3100";
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  | " + extra : ""}`); };
const post = (p, body, headers = { "Content-Type": "application/json" }) => fetch(B + p, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });

// check-gift: hero numbers
for (const [label, gift, expect] of [
  ["cash $1,000 -> $74", { amount: 1000, delivery: "cash", date: "2026-04-10" }, 74],
  ["vendor $420 -> $994", { amount: 420, delivery: "vendor", category: "equipment", date: "2026-04-10" }, 994],
  ["rent $800 monthly -> $662.67", { amount: 800, delivery: "vendor", category: "rent", recurring: true, date: "2026-04-10" }, 662.67],
  ["ABLE rent -> $994", { amount: 800, delivery: "able", category: "rent", date: "2026-04-10" }, 994],
]) {
  const r = await post("/api/v1/check-gift", { gift });
  const j = await r.json();
  ok(`check-gift ${label}`, r.status === 200 && j.data?.check_after === expect, `got ${j.data?.check_after}`);
}
const env = await (await post("/api/v1/check-gift", { gift: { amount: 50, delivery: "cash" } })).json();
ok("check-gift envelope has meta.request_id, rules_version, citations with urls", Boolean(env.meta?.request_id && env.meta?.rules_version && env.data?.citations?.every((c) => c.url)));
ok("check-gift default date (today) works", env.data?.income_month?.length === 7);

// validation and errors
let r = await post("/api/v1/check-gift", "not json");
ok("check-gift bad JSON -> 400 invalid_request", r.status === 400 && (await r.json()).error?.code === "invalid_request");
r = await post("/api/v1/check-gift", { gift: { amount: -5, delivery: "cash" } });
ok("check-gift negative amount -> 400", r.status === 400);
r = await post("/api/v1/check-gift", { gift: { amount: 5, delivery: "teleport" } });
ok("check-gift unknown delivery -> 400", r.status === 400);

// plan-month: shared quarterly exclusion
r = await post("/api/v1/plan-month", { gifts: [
  { date: "2026-04-05", amount: 50, delivery: "cash", giver: "Ana" },
  { date: "2026-06-25", amount: 50, delivery: "cash", giver: "Ben" },
] });
let j = await r.json();
ok("plan-month shares the $60 exclusion across the quarter (50 then 10)", r.status === 200 && j.data.months[0].infrequentExcluded === 50 && j.data.months[1].infrequentExcluded === 10);
r = await post("/api/v1/plan-month", { gifts: [] });
ok("plan-month empty list -> 400", r.status === 400);

// presets: download JSON and compare with expected values
const presets = ["wheelchair-repair", "birthday-cash", "electric-bill", "rent-help", "laptop-college", "groceries", "van-fundraiser", "march-month"];
for (const id of presets) {
  const res = await fetch(`${B}/api/presets/${id}`);
  const pj = await res.json();
  const exp = pj.preset?.expected ?? {};
  const got = pj.result?.check_after;
  const cd = res.headers.get("content-disposition") ?? "";
  const matches = exp.check_after === undefined || exp.check_after === got;
  ok(`preset ${id} download + expected result`, res.status === 200 && cd.includes("attachment") && matches, `expected ${exp.check_after ?? "-"} got ${got ?? "(month plan)"}; best ${pj.result?.best_route ?? "-"} vs ${exp.best_route ?? "-"}`);
}
r = await fetch(`${B}/api/presets/march-month?format=csv`);
const csv = await r.text();
ok("preset CSV download has header + 6 rows", r.status === 200 && csv.trim().split("\n").length === 7);
r = await fetch(`${B}/api/presets/nope`);
ok("unknown preset -> 404", r.status === 404);

// AI routes: live when ANTHROPIC_API_KEY is set on the server, friendly 503 otherwise
const fd = new FormData();
fd.append("file", new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }), "x.jpg");
r = await fetch(B + "/api/v1/read-bill", { method: "POST", body: fd });
j = await r.json();
ok("read-bill with a broken image -> friendly 422 (or 503 without AI)", (r.status === 422 || r.status === 503) && Boolean(j.error?.message), `${r.status}`);
const bill = new FormData();
bill.append("file", new Blob([await (await import("node:fs/promises")).readFile("public/samples/northside-electric-bill.png")], { type: "image/png" }), "bill.png");
r = await fetch(B + "/api/v1/read-bill", { method: "POST", body: bill });
j = await r.json();
if (r.status === 503) ok("read-bill live (skipped: AI not configured)", true);
else ok("read-bill live reads the electric bill as a $138 utility and routes to ABLE", r.status === 200 && j.data.bill.vendor_category === "utility" && j.data.bill.amount_due === 138 && j.data.check.best_route === "able", `${j.data?.bill?.vendor_category} ${j.data?.bill?.amount_due}`);
r = await post("/api/v1/analyze-fundraiser", { url: "/samples/fundraiser.html" });
j = await r.json();
if (r.status === 503) ok("analyze-fundraiser live (skipped: AI not configured)", true);
else ok("analyze-fundraiser live plans every use so her check stays $994", r.status === 200 && j.data.plan.length >= 2 && j.data.plan.every((p) => p.check_with_route === 994), `${j.data?.plan?.length} uses`);
r = await post("/api/v1/analyze-fundraiser", { url: "ftp://x" });
ok("analyze-fundraiser rejects non-http url", r.status === 400, `${r.status}`);

// Two reviewers, two rulebooks: each quote must be found word for word, and the engine picks the route
r = await post("/api/v1/review-bill", { amount: 10 });
ok("review-bill without a description -> 400", r.status === 400, `${r.status}`);
r = await post("/api/v1/review-bill", { description: "Northside Electric Co-op, residential electric service", amount: 138, category: "utility", date: "2026-04-10", recurring: true });
j = await r.json();
if (r.status === 503) ok("review-bill live (skipped: AI not configured)", true);
else ok("review-bill live: both reviewers quote their own rulebook, agree it is housing, and the engine routes to ABLE at $994", r.status === 200 && j.data.reviews.length === 2 && j.data.reviews.every((v) => v.quote_checked) && new Set(j.data.reviews.map((v) => v.authority)).size === 2 && j.data.referee.decision === "shelter" && j.data.outcome.route === "able" && j.data.outcome.check_after === 994, `${j.data?.referee?.decision} ${j.data?.outcome?.route} ${j.data?.outcome?.check_after}`);
r = await fetch(B + "/openapi.json");
j = await r.json();
ok("openapi lists review-bill with its request schema", Boolean(j.paths?.["/api/v1/review-bill"]?.post?.requestBody));

// Gift pages from a list of needs: the engine picks each route, and the page uses the chosen pronouns
r = await post("/api/v1/gift-pages", { name: "Jordan", pronoun: "they", organizer: "E2E", needs: [{ title: "Van wheelchair lift", amount: 1800, category: "transport", vendor: "a van conversion shop" }, { title: "Rent, December", amount: 650, category: "rent" }] });
j = await r.json();
ok("gift-pages: the lift is paid straight to the shop, rent goes to the ABLE account, check stays $994", r.status === 200 && j.data.needs[0].route === "vendor" && j.data.needs[1].route === "able" && j.data.needs.every((n) => n.check_after === 994), `${r.status} ${JSON.stringify(j.data?.needs?.map((n) => n.route))}`);
if (j.data?.url) {
  r = await fetch(B + j.data.url);
  const text = ((await r.text()).match(/<body[\s\S]*<\/body>/)?.[0] ?? "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
  ok("the new page reads Help Jordan and uses their, never her or she", r.status === 200 && text.includes("Help Jordan") && /\btheir\b/.test(text) && !/\b(her|she)\b/i.test(text));
}
r = await post("/api/v1/gift-pages", { name: "<b>x</b>", pronoun: "she", needs: [{ title: "Chair", amount: 50, category: "equipment" }] });
ok("gift-pages rejects a name that is not letters", r.status === 400, `${r.status}`);

// PayPal order creation through the app (server picks amount + payee)
r = await post("/api/paypal/orders", { needId: 4 });
j = await r.json();
ok("paypal order for need 4 created (sandbox)", r.status === 200 && /^[A-Z0-9]+$/.test(j.data?.id ?? ""), j.data?.id ?? j.error?.message);
r = await post("/api/paypal/orders", { needId: 9999 });
ok("paypal order for unknown need -> 404", r.status === 404);
r = await post("/api/paypal/orders", { needId: "1; drop table" });
// A hosted run may meet the platform firewall first, which refuses this body with 403 before it reaches the app.
ok("paypal order with bad id -> 400 (or 403 from the host firewall)", r.status === 400 || (r.status === 403 && !/localhost|127.0.0.1/.test(B)), `${r.status}`);
r = await fetch(B + "/api/paypal/orders/NOTANORDER123/capture", { method: "POST" });
ok("capture unknown order -> 404", r.status === 404, `${r.status}`);
r = await fetch(B + "/api/paypal/orders/../../etc/capture", { method: "POST" });
ok("capture path traversal -> not 200", r.status !== 200, `${r.status}`);
if (j.data?.id) {
  r = await fetch(`${B}/api/paypal/orders/${j.data.id}/capture`, { method: "POST" });
  const cj = await r.json();
  ok("capture before buyer approval -> PayPal refuses, app returns plain error", r.status >= 400 && Boolean(cj.error?.message), `${r.status} ${cj.error?.details?.issue ?? ""}`);
}

// Give any amount: one order, split by the rules across needs and ABLE
r = await post("/api/paypal/gift-orders", { slug: "maya", amount: 1500 });
j = await r.json();
const units = j.data?.plan?.lines ?? [];
ok("gift-orders $1,500 -> one order, every open need plus ABLE", r.status === 200 && units.length === 5 && units.at(-1)?.referenceId === "able-savings", `${units.length} lines`);
ok("gift-orders plan keeps her full check, cash would not", j.data?.plan?.checkWithRouting === 994 && j.data?.plan?.checkIfCash < 994, `${j.data?.plan?.checkIfCash} vs ${j.data?.plan?.checkWithRouting}`);
ok("gift-orders lines add up to the gift", Math.abs(units.reduce((s, l) => s + l.amount, 0) - 1500) < 0.01);
if (j.data?.id) {
  r = await fetch(`${B}/api/paypal/orders/${j.data.id}`);
  const live = await r.json();
  ok("live order check returns each payee unit from PayPal", r.status === 200 && live.data?.units?.length === 5 && ["CREATED", "PAYER_ACTION_REQUIRED"].includes(live.data?.status), `${live.data?.status}`);
  r = await fetch(`${B}/r/${j.data.id}`);
  ok("receipt page renders for a started order", r.status === 200);
}
r = await post("/api/paypal/gift-orders", { slug: "maya", amount: 0 });
ok("gift-orders $0 -> 400", r.status === 400);
r = await post("/api/paypal/gift-orders", { slug: "nobody-here", amount: 50 });
ok("gift-orders unknown page -> 404", r.status === 404, `${r.status}`);
r = await fetch(`${B}/api/paypal/orders/bad-id`);
ok("live order check with bad id -> 400", r.status === 400);
r = await fetch(`${B}/r/ZZZZZZZZZZZZZZZZ`);
// Streaming has begun by then, so Next keeps 200 and renders the not-found UI with noindex (docs: streaming.md, Status codes).
const nf = await r.text();
ok("receipt for unknown order -> not-found page, noindex", r.status === 404 || (/noindex/.test(nf) && !/rc-total/.test(nf)), `${r.status}`);
r = await fetch(`${B}/api/ledger/verify`);
j = await r.json();
ok("ledger verifies end to end", r.status === 200 && j.data?.ok === true, `${j.data?.count} entries`);

// Developer keys: create, use, usage, rotate, revoke
r = await post("/api/keys", { name: "E2E", email: `e2e-${Date.now()}@example.com`, purpose: "tests", accept: true });
j = await r.json();
const cookie = (r.headers.get("set-cookie") ?? "").split(";")[0];
const key = j.data?.key ?? "";
ok("key created, shown once, gw_test_ plus 43 base62 characters", r.status === 200 && /^gw_test_[0-9A-Za-z]{43}$/.test(key) && Boolean(cookie), j.data?.prefix);
r = await post("/api/keys", { name: "E2E", email: "x@example.com" });
ok("key without accepting terms -> 400", r.status === 400);
r = await fetch(B + "/api/v1/check-gift", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ gift: { amount: 420, delivery: "vendor", category: "equipment" } }) });
ok("keyed call works and returns rate-limit headers", r.status === 200 && r.headers.get("x-ratelimit-limit") === "60", `${r.status} ${r.headers.get("x-ratelimit-remaining")}`);
r = await fetch(B + "/api/v1/check-gift", { method: "POST", headers: { Authorization: "Bearer gw_test_nope", "Content-Type": "application/json" }, body: "{}" });
ok("unknown key -> 401 unauthorized", r.status === 401 && (await r.json()).error?.code === "unauthorized");
r = await fetch(B + "/api/keys", { headers: { cookie } });
j = await r.json();
const mine = j.data?.keys?.[0];
ok("usage lists the key and its call", mine?.calls_24h === 1 && j.data?.requests?.[0]?.endpoint === "check-gift", `${mine?.calls_24h} calls`);
r = await fetch(`${B}/api/keys/${mine?.id}/revoke`, { method: "POST" });
ok("revoke from another browser -> 404", r.status === 404);
r = await fetch(`${B}/api/keys/${mine?.id}/rotate`, { method: "POST", headers: { cookie } });
j = await r.json();
const rotated = j.data?.key;
r = await fetch(B + "/api/v1/check-gift", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ gift: { amount: 1, delivery: "cash" } }) });
const oldStatus = r.status;
r = await fetch(B + "/api/v1/check-gift", { method: "POST", headers: { Authorization: `Bearer ${rotated}`, "Content-Type": "application/json" }, body: JSON.stringify({ gift: { amount: 1, delivery: "cash" } }) });
ok("rotate: old key stops, new key works", oldStatus === 401 && r.status === 200, `${oldStatus} then ${r.status}`);
r = await fetch(B + "/openapi.json");
j = await r.json();
ok("openapi.json is 3.1 and lists every endpoint", j.openapi === "3.1.0" && ["/api/v1/check-gift", "/api/v1/plan-month", "/api/v1/read-bill", "/api/v1/analyze-fundraiser", "/api/v1/review-bill", "/api/presets/{id}", "/api/ledger/verify", "/api/health", "/api/keys"].every((p) => j.paths[p]) && Boolean(j.paths["/api/v1/check-gift"].post.requestBody.content["application/json"].schema.properties.gift));
r = await fetch(B + "/api/presets/not-a-preset");
ok("unknown preset -> 404 in the standard envelope", r.status === 404 && (await r.json()).error?.code === "not_found");

// Calls from here on use the rotated test key, the way an integration or an agent would.
const keyed = { "Content-Type": "application/json", Authorization: `Bearer ${rotated}` };

// The monthly report to Social Security, written from the gifts
// Keyed, so the suite stays inside the 20-a-minute limit for calls without a key.
r = await fetch(B + "/api/v1/ssa-report?page=maya&month=2026-10", { headers: keyed });
j = await r.json();
ok("ssa-report October as given: 5 gifts, nothing counts, check stays $994, due November 10", r.status === 200 && j.data?.status === "nothing_counts" && j.data?.totals?.gifts === 5 && j.data?.totals?.check === 994 && j.data?.due?.date === "2026-11-10", `${j.data?.status} ${j.data?.totals?.check}`);
ok("ssa-report records every gift with a rule and a cited source", (j.data?.lines ?? []).every((l) => l.section === "records" && l.rule_ids.length > 0 && l.sources.every((s) => s.url.startsWith("https://"))));
r = await fetch(B + "/api/v1/ssa-report?page=maya&month=2026-10&view=cash", { headers: keyed });
j = await r.json();
ok("ssa-report the same October as cash: 5 gifts to tell SSA, $538 counted, check $456, a call script", j.data?.status === "report" && j.data?.totals?.tell === 5 && j.data?.totals?.counted === 538 && j.data?.totals?.check === 456 && j.data?.script?.length === 7, `${j.data?.totals?.counted} ${j.data?.totals?.check}`);
r = await fetch(B + "/api/v1/ssa-report?page=maya&month=2026-10&format=csv", { headers: keyed });
const reportCsvText = await r.text();
ok("ssa-report CSV download has a header and one row per gift", r.status === 200 && (r.headers.get("content-type") ?? "").startsWith("text/csv") && reportCsvText.trim().split("\n").length === 6 && reportCsvText.startsWith("date,from,for,paid_to,amount,tell_ssa"));
r = await fetch(B + "/api/v1/ssa-report?page=maya&month=2026-13", { headers: keyed });
ok("ssa-report bad month -> 400", r.status === 400);
r = await fetch(B + "/api/v1/ssa-report?page=nobody-at-all", { headers: keyed });
ok("ssa-report unknown page -> 404", r.status === 404);
r = await fetch(B + "/g/maya/report?month=2026-10");
const rpHtml = await r.text();
ok("report page renders the verdict and the PayPal proof column", r.status === 200 && rpHtml.includes("Nothing here counts as income.") && rpHtml.includes("For your records"));

// The outside checks: only the workflow, holding CHECKS_SECRET, may run single cases or file results
r = await fetch(B + "/api/checks/case/list");
j = await r.json();
ok("checks: the workflow can list the eight failure cases", r.status === 200 && j.data?.length === 8, `${j.data?.length}`);
r = await post("/api/checks/case/declined", {});
ok("checks: running a case without the secret -> 401 (or 503 if the server has none)", r.status === 401 || r.status === 503, `${r.status}`);
r = await post("/api/checks", { source: "local" }, { "Content-Type": "application/json", Authorization: "Bearer not-the-secret" });
ok("checks: filing a run with the wrong secret -> 401 (or 503 if the server has none)", r.status === 401 || r.status === 503, `${r.status}`);
if (process.env.CHECKS_SECRET && /localhost|127\.0\.0\.1/.test(B)) {
  r = await post("/api/checks", { source: "local", appUrl: B, startedAt: "not a date", results: [] }, { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CHECKS_SECRET}` });
  ok("checks: a malformed run with the right secret -> 400 with details", r.status === 400 && (await r.json()).error?.code === "invalid_request");
}
r = await fetch(B + "/api/checks/latest");
j = await r.json();
ok("checks: the latest run is public, with a pass count", r.status === 200 && (j.data?.run === null || typeof j.data?.run?.passed === "number"), j.data?.run ? `${j.data.run.passed}/${j.data.run.total} ${j.data.run.source}` : "no run yet");
r = await post("/api/checks/start", {});
ok("checks: starting a run needs Render Workflows (503 here) or is rate limited (429)", [200, 429, 503].includes(r.status), `${r.status}`);

// The MCP server, called with an API key the way an agent would: initialize, list tools, call one, and answer bad input as a tool error
const mcp = (method, params, id = 1) => post("/api/mcp", { jsonrpc: "2.0", id, method, params }, keyed);
r = await mcp("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e", version: "1" } });
j = await r.json();
ok("MCP initialize names the server and agrees a protocol version", r.status === 200 && j.result?.serverInfo?.name === "giftwise" && j.result?.protocolVersion === "2025-06-18");
r = await post("/api/mcp", { jsonrpc: "2.0", method: "notifications/initialized" }, keyed);
ok("MCP notification -> 202 with no body", r.status === 202);
r = await mcp("tools/list");
j = await r.json();
const names = (j.result?.tools ?? []).map((t) => t.name);
ok("MCP lists the six tools with input schemas", ["check_gift", "get_gift_page", "get_ssa_report", "plan_gift", "review_bill", "start_gift_checkout"].every((n) => names.includes(n)) && j.result.tools.every((t) => t.inputSchema?.type === "object"), names.join(","));
r = await mcp("tools/call", { name: "plan_gift", arguments: { slug: "maya", amount: 500 } });
j = await r.json();
ok("MCP plan_gift splits $500 so her check stays $994 (cash would be $574)", j.result?.structuredContent?.check_with_giftwise === 994 && j.result?.structuredContent?.check_if_cash === 574, j.result?.content?.[0]?.text?.slice(0, 80));
r = await mcp("tools/call", { name: "get_ssa_report", arguments: { slug: "maya", month: "2026-10" } });
j = await r.json();
ok("MCP get_ssa_report: October needs no income report, due November 10", j.result?.structuredContent?.status === "nothing_counts" && j.result?.structuredContent?.due?.date === "2026-11-10" && /Nothing here counts as income/.test(j.result?.content?.[0]?.text ?? ""), j.result?.content?.[0]?.text?.slice(0, 80));
r = await mcp("tools/call", { name: "check_gift", arguments: { amount: "lots" } });
j = await r.json();
ok("MCP bad arguments come back as a tool error the agent can read", r.status === 200 && j.result?.isError === true && /amount/.test(j.result?.content?.[0]?.text ?? ""));
r = await mcp("nope/never");
j = await r.json();
ok("MCP unknown method -> JSON-RPC -32601", j.error?.code === -32601);

// PayPal webhooks: an event without a valid PayPal signature is never accepted (400, or 503 where webhooks are not set up)
r = await post("/api/paypal/webhook", { id: "WH-TEST", event_type: "PAYMENT.CAPTURE.REFUNDED", resource: { id: "NOPE" } });
ok("unsigned PayPal webhook is refused", r.status === 400 || r.status === 503, `${r.status}`);


// Payouts for organizations: the rules route each grant, one PayPal batch pays every payee, and PayPal reports each item paid
r = await post("/api/org/payouts", { grants: [{ slug: "maya", amount: 900 }] });
ok("org payouts over the per-household sandbox limit -> 400", r.status === 400, `${r.status}`);
r = await post("/api/org/payouts", { grants: [{ slug: "nobody-here", amount: 20 }] });
ok("org payouts to an unknown page -> 422", r.status === 422, `${r.status}`);
r = await post("/api/org/payouts", { grants: [{ slug: "maya", amount: 10 }], preview: true });
j = await r.json();
ok("org payouts preview routes a $10 grant and keeps the check at $994", r.status === 200 && j.data.preview === true && j.data.items.length >= 1 && j.data.households[0].checkWithGrant === 994, JSON.stringify(j.data?.items?.map((i) => i.payeeName)));
r = await post("/api/org/payouts", { grants: [{ slug: "maya", amount: 10 }] });
j = await r.json();
const payoutBatch = j.data?.batch_id;
ok("org payouts sends one PayPal Payouts batch", r.status === 200 && /^[A-Z0-9]{8,30}$/.test(payoutBatch ?? ""), `${r.status} ${payoutBatch ?? j.error?.message}`);
if (payoutBatch) {
  let b = null;
  for (let i = 0; i < 20; i++) {
    b = (await (await fetch(`${B}/api/org/payouts/${payoutBatch}`)).json()).data;
    if (b?.batch_status === "SUCCESS") break;
    await new Promise((res) => setTimeout(res, 3000));
  }
  ok("PayPal reports the batch sent, with a transaction id for every item", b?.batch_status === "SUCCESS" && b.items.every((i) => i.status === "SUCCESS" && i.transaction_id), `${b?.batch_status} ${b?.items?.map((i) => i.status).join(",")}`);
  ok("each paid item is checked against PayPal's transaction report", b?.items.every((i) => ["found", "waiting"].includes(i.in_paypal_report)), b?.items?.map((i) => i.in_paypal_report).join(","));
}
r = await fetch(`${B}/api/org/payouts/NOTABATCH1`);
ok("unknown payout batch -> 404", r.status === 404, `${r.status}`);
await post("/api/demo/reset", {});
console.log(`\n${pass} passed, ${fail} failed`);
