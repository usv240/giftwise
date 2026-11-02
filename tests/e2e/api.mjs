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
ok("paypal order with bad id -> 400", r.status === 400);
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

console.log(`\n${pass} passed, ${fail} failed`);
