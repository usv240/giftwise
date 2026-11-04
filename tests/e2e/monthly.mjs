// A monthly gift, end to end in the PayPal sandbox: start $300 a month for Maya, approve the first month as the sandbox
// buyer, plan the next month, check the rules routed it again with what changed and why, approve that too, and check
// PayPal paid every purchase unit to its own payee. Needs SANDBOX_BUYER_EMAIL and SANDBOX_BUYER_PASSWORD.
// Usage: BASE_URL=http://localhost:3100 npm run e2e:monthly
import { chromium } from "playwright-core";

const B = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = process.argv[2] ?? ".taste-skill";
const email = process.env.SANDBOX_BUYER_EMAIL, pass = process.env.SANDBOX_BUYER_PASSWORD;
let passed = 0, failed = 0;
const ok = (n, c, x = "") => { if (c) passed++; else failed++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? "  | " + x : ""}`); };
if (!email || !pass) {
  console.log("Set SANDBOX_BUYER_EMAIL and SANDBOX_BUYER_PASSWORD to run the monthly gift test.");
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await fetch(`${B}/api/demo/reset`, { method: "POST" });

async function approve(popup) {
  await popup.waitForLoadState("domcontentloaded");
  const emailBox = popup.locator('input#email, input[type="email"]').first();
  const passBox = popup.locator('input#password, input[type="password"]').first();
  const payBtn = popup.locator('button[data-testid="submit-button-initial"], button#payment-submit-btn, button:has-text("Complete Purchase"), button:has-text("Pay Now"), button:has-text("Continue to Review Order")').first();
  await Promise.race([emailBox.waitFor({ timeout: 45000 }), passBox.waitFor({ timeout: 45000 }), payBtn.waitFor({ timeout: 45000 })]).catch(() => {});
  if (await emailBox.isVisible().catch(() => false)) {
    await emailBox.fill(email);
    const next = popup.locator("button#btnNext");
    if (await next.isVisible().catch(() => false)) await next.click();
  }
  if ((await passBox.isVisible({ timeout: 10000 }).catch(() => false)) || (await passBox.waitFor({ timeout: 10000 }).then(() => true).catch(() => false))) {
    await passBox.fill(pass);
    await popup.locator("button#btnLogin").click();
  }
  await payBtn.waitFor({ timeout: 60000 });
  await payBtn.click();
}

/** Press the month's PayPal button, approve as the buyer, and return the order id the page asked the server for. */
async function payMonth(card, tag) {
  const orderReq = page.waitForResponse((r) => /\/api\/monthly\/[^/]+\/order$/.test(r.url()) && r.request().method() === "POST", { timeout: 60000 });
  const popupP = ctx.waitForEvent("page", { timeout: 30000 });
  await card.locator("paypal-button:not([hidden])").click();
  const j = await (await orderReq).json();
  const popup = await popupP;
  await approve(popup);
  await card.locator(".mo-status[data-paid]").waitFor({ timeout: 120000 }).catch(() => {});
  await page.screenshot({ path: `${OUT}/monthly-${tag}.png`, fullPage: true });
  return j.data?.id;
}

const start = await (await fetch(`${B}/api/monthly`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: "maya", amount: 300, giver_name: "June" }) })).json();
ok("a monthly gift starts and returns the giver's link", /^\/m\/[\w-]{20,}$/.test(start.data?.url ?? ""), start.data?.url);

await page.goto(`${B}${start.data.url}`, { waitUntil: "networkidle" });
const first = page.locator(".mo-month").first();
const firstMonth = (await first.locator(".mo-month-title").textContent())?.trim();
ok("the current month is planned when the page opens", (await first.locator(".mo-lines li").count()) > 0, firstMonth);
// November's gift counts in January's check, paid at the 2027 rate (91 FR 67380; POMS SI 02005.001 E.4.c).
const PAY = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 2, 1));
const FULL = PAY.getUTCFullYear() >= 2027 ? "1,029" : "994";
ok(`its check stays $${FULL}`, new RegExp(`check stays \\$${FULL}`).test((await first.locator(".mo-check").textContent()) ?? ""));
await page.waitForFunction(() => document.querySelectorAll(".mo-month paypal-button:not([hidden])").length > 0, null, { timeout: 30000 });
const firstOrder = await payMonth(first, "first");
ok("the first month is paid", (await first.locator(".mo-status[data-paid]").count()) === 1, firstOrder);

await page.getByRole("button", { name: /^Plan .* now$/ }).click();
await page.waitForFunction((n) => document.querySelectorAll(".mo-month").length > n, 1, { timeout: 30000 });
const second = page.locator(".mo-month").first();
const secondMonth = (await second.locator(".mo-month-title").textContent())?.trim();
const changes = (await second.locator(".mo-changes li").allTextContents()).map((t) => t.replace(/\s+/g, " ").trim());
ok("the next month is routed again, with what changed and why", changes.length > 0, `${secondMonth}: ${changes.join(" / ")}`);
await page.waitForFunction(() => document.querySelectorAll(".mo-month paypal-button:not([hidden])").length > 0, null, { timeout: 30000 });
const secondOrder = await payMonth(second, "second");
ok("the next month is paid with a new order", Boolean(secondOrder) && secondOrder !== firstOrder, secondOrder);

for (const id of [firstOrder, secondOrder]) {
  const o = await (await fetch(`${B}/api/paypal/orders/${id}`)).json();
  const units = o.data?.units ?? [];
  const each = units.every((u) => u.captures?.[0]?.status === "COMPLETED");
  const payees = new Set(units.map((u) => u.payee_email)).size;
  ok(`PayPal: order ${id} COMPLETED, every unit captured to its own payee`, o.data?.status === "COMPLETED" && units.length > 0 && each && payees === units.length, `${units.length} units, ${payees} payees`);
}

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
