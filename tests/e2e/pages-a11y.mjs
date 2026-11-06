// axe (WCAG 2.2 AA, serious and critical) and sideways-scroll checks on every page, desktop and phone, light and dark.
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
const B = process.env.BASE_URL ?? "http://localhost:3100";
const AXE = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

// A receipt needs a real order: start one (no payment) so its page exists.
const order = await (await fetch(`${B}/api/paypal/gift-orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: "maya", amount: 300 }) })).json();
// A monthly gift (no payment yet), so the giver's monthly page is checked too.
const monthly = await (await fetch(`${B}/api/monthly`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: "maya", amount: 300 }) })).json();
// The page that checks October's report against PayPal and the ledger.
const verify = await (await fetch(`${B}/api/v1/ssa-report?page=maya&month=2026-10`)).json();
// A gift page made from a list of needs, they/them, so the generated pages are checked too.
const made = await (await fetch(`${B}/api/v1/gift-pages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Jordan", pronoun: "they", organizer: "E2E", needs: [{ title: "Van wheelchair lift", amount: 1800, category: "transport", vendor: "a van conversion shop" }, { title: "Rent, December", amount: 650, category: "rent" }] }) })).json();
const routes = ["/", "/try", "/try/presets/electric-bill", "/learn", "/g/maya", "/g/maya?lang=es", "/g/maya/report?month=2026-10", "/g/maya/report?month=2026-10&view=cash", "/g/maya/report/easy?month=2026-10", "/g/maya/report/easy?month=2026-10&lang=es&view=cash", "/g/maya/calendar", "/manage/maya-sample-organizer", ...(verify.data?.verify?.url ? [verify.data.verify.url.replace(/^https?:\/\/[^/]+/, "")] : []), ...(monthly.data?.url ? [monthly.data.url] : []), ...(made.data?.url ? [made.data.url] : []), "/evidence", "/agents", "/dashboard", "/organizations", "/developers", "/developers/docs", "/developers/keys", "/status", "/ops", "/stack", "/about", ...(order.data?.id ? [`/r/${order.data.id}`, `/r/${order.data.id}?lang=es`] : [])];

const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
let failed = 0;
for (const route of routes) for (const w of [1440, 390]) for (const theme of ["light", "dark"]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto(`${B}${route}${route.includes("?") ? "&" : "?"}theme=${theme}`, { waitUntil: "networkidle" });
  await p.addScriptTag({ content: AXE });
  const v = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] })).violations.filter((x) => ["serious", "critical"].includes(x.impact)).map((x) => `${x.id}: ${x.nodes[0]?.target}`));
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (v.length || overflow) failed++;
  console.log(route, w, theme, v.length ? "FAIL " + v.join("; ") : "axe ok", overflow ? "| SIDEWAYS SCROLL" : "");
  await p.close();
}
await b.close();
console.log(failed ? `\n${failed} page views with problems` : "\nall page views pass");
