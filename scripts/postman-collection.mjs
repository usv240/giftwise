/**
 * Writes the Giftwise API as a Postman collection (v2.1) with a test on every request, and an environment, into
 * postman/. Import both into Postman, or run them with Newman: npm run test:postman (BASE_URL to aim elsewhere).
 * Every request uses the demo allowance unless {{apiKey}} is set; nothing here moves money.
 */
import { mkdirSync, writeFileSync } from "node:fs";

const json = (o) => ({ mode: "raw", raw: JSON.stringify(o, null, 2), options: { raw: { language: "json" } } });
const H = [{ key: "Content-Type", value: "application/json" }];
const auth = { type: "bearer", bearer: [{ key: "token", value: "{{apiKey}}", type: "string" }] };
const url = (path, query = []) => ({ raw: `{{baseUrl}}${path}${query.length ? `?${query.map((q) => `${q.key}=${q.value}`).join("&")}` : ""}`, host: ["{{baseUrl}}"], path: path.replace(/^\//, "").split("/"), query });
const tests = (lines) => [{ listen: "test", script: { type: "text/javascript", exec: lines } }];

const item = (name, description, request, testLines) => ({ name, request: { ...request, description }, event: tests(testLines) });
const get = (path, query) => ({ method: "GET", header: [], url: url(path, query) });
const post = (path, body) => ({ method: "POST", header: H, body: json(body), url: url(path) });

const collection = {
  info: {
    name: "Giftwise API",
    _postman_id: "8f3b1a52-6d0e-4c1b-9b7e-7a1f0c2e5d41",
    description:
      "Benefit-safe giving for people on SSI. Check a gift against Social Security's rules, plan a month, read a person's report to SSA and check it against PayPal, ask the rulebook, and talk to the MCP server. Sandbox only: no real money moves. Each request has tests; run the whole collection in Postman or with Newman.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth,
  variable: [{ key: "baseUrl", value: "https://giftwise-405i.onrender.com" }],
  item: [
    {
      name: "Rules",
      item: [
        item("Check a gift: $1,000 in cash", "Cash counts as income: two months later the $994 check drops to $74.", post("/api/v1/check-gift", { gift: { amount: 1000, delivery: "cash", date: "2026-04-10" } }), [
          'pm.test("200 with the standard envelope", () => { pm.response.to.have.status(200); pm.expect(pm.response.json().meta.request_id).to.be.a("string"); });',
          'pm.test("cash leaves a $74 check", () => pm.expect(pm.response.json().data.check_after).to.eql(74));',
          'pm.test("every citation has a source link", () => pm.response.json().data.citations.forEach((c) => pm.expect(c.url).to.match(/^https:/)));',
        ]),
        item("Check a gift: the same $420 paid to the shop", "Paid straight to the shop, the check stays $994.", post("/api/v1/check-gift", { gift: { amount: 420, delivery: "vendor", category: "equipment", date: "2026-04-10" } }), [
          'pm.test("the check stays $994", () => pm.expect(pm.response.json().data.check_after).to.eql(994));',
        ]),
        item("Check a gift: rent paid to the landlord", "Housing paid by someone else counts even when paid straight to the landlord.", post("/api/v1/check-gift", { gift: { amount: 800, delivery: "vendor", category: "rent", recurring: true, date: "2026-04-10" } }), [
          'pm.test("rent lowers the check to $662.67", () => pm.expect(pm.response.json().data.check_after).to.eql(662.67));',
        ]),
        item("Plan a quarter: two cash gifts share one $60", "The $60 exclusion for one-time gifts is per calendar quarter.", post("/api/v1/plan-month", { gifts: [{ date: "2026-04-05", amount: 50, delivery: "cash", giver: "Ana" }, { date: "2026-06-25", amount: 50, delivery: "cash", giver: "Ben" }] }), [
          'const m = pm.response.json().data.months;',
          'pm.test("the first gift takes $50 of the exclusion, the second the last $10", () => { pm.expect(m[0].infrequentExcluded).to.eql(50); pm.expect(m[1].infrequentExcluded).to.eql(10); });',
        ]),
        item("A bad request gets a plain answer", "Errors carry a code, a message in plain words and a link to the docs.", post("/api/v1/check-gift", { gift: { amount: -5, delivery: "cash" } }), [
          'pm.test("400 invalid_request", () => { pm.response.to.have.status(400); pm.expect(pm.response.json().error.code).to.eql("invalid_request"); });',
        ]),
      ],
    },
    {
      name: "Reports",
      item: [
        item("Maya's October report to Social Security", "Written from the gifts themselves. The answer names a code anyone can use to check it.", get("/api/v1/ssa-report", [{ key: "page", value: "maya" }, { key: "month", value: "2026-10" }]), [
          'const d = pm.response.json().data;',
          'pm.test("nothing counts and the check stays $994", () => { pm.expect(d.status).to.eql("nothing_counts"); pm.expect(d.totals.check).to.eql(994); });',
          'pm.test("the report carries its check code", () => pm.expect(d.verify.code).to.match(/^[0-9A-Z]{5}-[0-9A-Z]{5}$/));',
          'pm.collectionVariables.set("verifyPath", "/" + d.verify.url.split("/").slice(3).join("/"));',
        ]),
        item("Check that report", "Giftwise rebuilds the report, asks PayPal for each payment and checks the audit ledger.", { method: "GET", header: [], url: { raw: "{{baseUrl}}{{verifyPath}}", host: ["{{baseUrl}}{{verifyPath}}"] } }, [
          'pm.test("the report matches", () => { pm.response.to.have.status(200); pm.expect(pm.response.text()).to.include("This report matches"); });',
        ]),
        item("The audit ledger", "Every entry's fingerprint includes the one before it.", get("/api/ledger/verify"), ['pm.test("the hash chain verifies", () => pm.expect(pm.response.json().data.ok).to.eql(true));']),
      ],
    },
    {
      name: "Rulebook",
      item: [
        item("Ask the rulebook", "Elasticsearch (or the in-app search) finds the passages; the answer uses only them; every quote is checked.", post("/api/v1/ask-rules", { question: "Does it count if my sister pays my phone bill?" }), [
          'const d = pm.response.json().data;',
          'pm.test("passages from SSA\'s own text", () => pm.expect(d.passages.length).to.be.above(0));',
          'pm.test("every quote shown is checked against its passage", () => d.quotes.forEach((q) => pm.expect(q.found_word_for_word).to.be.a("boolean")));',
        ]),
        item("The rules watch the Federal Register", "Every Federal Register change to SSI's income rules and amounts, with what Giftwise does with it.", get("/api/rules-watch"), [
          'pm.test("the Federal Register documents are all reviewed", () => pm.expect(["current", "unreachable"]).to.include(pm.response.json().data.status));',
        ]),
      ],
    },
    {
      name: "AI agents",
      item: [
        item("MCP: list the tools", "The MCP server over streamable HTTP.", post("/api/mcp", { jsonrpc: "2.0", id: 1, method: "tools/list" }), [
          'const names = pm.response.json().result.tools.map((t) => t.name);',
          'pm.test("nine tools, including checkout and the report", () => { pm.expect(names.length).to.eql(9); ["check_gift", "start_gift_checkout", "get_ssa_report", "ask_rulebook", "find_gift"].forEach((n) => pm.expect(names).to.include(n)); });',
        ]),
        item("MCP: check a gift", "The same rules engine, called as a tool.", post("/api/mcp", { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "check_gift", arguments: { amount: 1000, delivery: "cash", date: "2026-04-10" } } }), [
          'pm.test("the tool answers with the check", () => pm.expect(pm.response.json().result.structuredContent.check_after).to.eql(74));',
        ]),
        item("Discovery: the AI Catalog", "SEP-2127: the domain lists its MCP Server Card.", get("/.well-known/ai-catalog.json"), [
          'const e = pm.response.json().entries.find((x) => x.type === "application/mcp-server-card+json");',
          'pm.test("an entry for the MCP Server Card", () => pm.expect(e.url).to.include("/api/mcp/server-card"));',
        ]),
        item("Discovery: the MCP Server Card", "Identity and connection details, before connecting.", get("/api/mcp/server-card"), [
          'pm.test("names the streamable HTTP endpoint", () => pm.expect(pm.response.json().remotes[0].url).to.include("/api/mcp"));',
        ]),
        item("OpenAPI", "The REST API, described.", get("/openapi.json"), ['pm.test("describes check-gift", () => pm.expect(Object.keys(pm.response.json().paths)).to.include("/api/v1/check-gift"));']),
      ],
    },
    {
      name: "Service",
      item: [item("Health", "Every integration and whether it is live.", get("/api/health"), ['pm.test("lists the integrations", () => pm.expect(pm.response.json().checks.length).to.be.above(5));'])],
    },
  ],
};

const environment = {
  id: "2c7e9d0a-4f8b-4a3e-b1d2-5e6f7a8b9c0d",
  name: "Giftwise sandbox",
  values: [
    { key: "baseUrl", value: process.env.BASE_URL ?? "https://giftwise-405i.onrender.com", type: "default", enabled: true },
    { key: "apiKey", value: "", type: "secret", enabled: true },
  ],
  _postman_variable_scope: "environment",
};

mkdirSync("postman", { recursive: true });
writeFileSync("postman/giftwise.postman_collection.json", JSON.stringify(collection, null, 2) + "\n");
writeFileSync("postman/giftwise.postman_environment.json", JSON.stringify(environment, null, 2) + "\n");
// The same files, served by the site so developers can import them from /developers/docs.
mkdirSync("public/postman", { recursive: true });
writeFileSync("public/postman/giftwise.postman_collection.json", JSON.stringify(collection, null, 2) + "\n");
writeFileSync("public/postman/giftwise.postman_environment.json", JSON.stringify(environment, null, 2) + "\n");
const count = collection.item.reduce((a, f) => a + f.item.length, 0);
console.log(`wrote postman/: ${count} requests in ${collection.item.length} folders`);
