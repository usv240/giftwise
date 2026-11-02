// An AI agent starts a gift checkout over MCP; a person approves the PayPal link as the sandbox buyer;
// PayPal sends them back to Giftwise, which captures every payee and shows the receipt.
// Needs SANDBOX_BUYER_EMAIL and SANDBOX_BUYER_PASSWORD. Usage: npm run e2e:agent
import { chromium } from "playwright-core";

const B = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = process.argv[2] ?? ".taste-skill";
const email = process.env.SANDBOX_BUYER_EMAIL, password = process.env.SANDBOX_BUYER_PASSWORD;
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { if (c) pass++; else fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? "  | " + x : ""}`); };

let id = 0;
async function rpc(method, params) {
  const r = await fetch(`${B}/api/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
  return (await r.json()).result;
}

await fetch(`${B}/api/demo/reset`, { method: "POST" });
await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e-agent", version: "1" } });
const started = await rpc("tools/call", { name: "start_gift_checkout", arguments: { slug: "maya", amount: 600 } });
const d = started?.structuredContent ?? {};
ok("start_gift_checkout returns a PayPal approval link and a receipt address", !started?.isError && /paypal\.com/.test(d.approve_url ?? "") && Boolean(d.order_id), started?.content?.[0]?.text?.slice(0, 120));
ok("the checkout is split by the rules across several payees", (d.lines?.length ?? 0) >= 2 && d.check_with_giftwise === 994, JSON.stringify(d.lines?.map((l) => l.paid_to)));

if (d.approve_url && email && password) {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(d.approve_url, { waitUntil: "domcontentloaded" });
  const emailBox = page.locator('input#email, input[type="email"]').first();
  const passBox = page.locator('input#password, input[type="password"]').first();
  const payBtn = page.locator('button[data-testid="submit-button-initial"], button#payment-submit-btn, button:has-text("Complete Purchase"), button:has-text("Pay Now"), button:has-text("Continue to Review Order")').first();
  await Promise.race([emailBox.waitFor({ timeout: 60000 }), passBox.waitFor({ timeout: 60000 }), payBtn.waitFor({ timeout: 60000 })]).catch(() => {});
  if (await emailBox.isVisible().catch(() => false)) {
    await emailBox.fill(email);
    const next = page.locator("button#btnNext");
    if (await next.isVisible().catch(() => false)) await next.click();
  }
  if (await passBox.waitFor({ timeout: 15000 }).then(() => true).catch(() => false)) {
    await passBox.fill(password);
    await page.locator("button#btnLogin").click();
  }
  await payBtn.waitFor({ timeout: 60000 });
  await payBtn.click();
  await page.waitForURL(new RegExp(`/r/${d.order_id}`), { timeout: 90000, waitUntil: "commit" });
  await page.locator(".rc-total").waitFor({ timeout: 60000 });
  const given = (await page.locator(".rc-summary .rc-k").first().textContent())?.trim();
  ok("after approval PayPal returns to Giftwise, which captures and opens the receipt", given === "Given", given);
  ok("the receipt lists every payee", (await page.locator(".rc-line").count()) === d.lines.length);
  await page.screenshot({ path: `${OUT}/agent-receipt.png`, fullPage: true });
  await browser.close();
  const live = await (await fetch(`${B}/api/paypal/orders/${d.order_id}`)).json();
  ok("PayPal says the agent-started order is COMPLETED", live.data?.status === "COMPLETED", live.data?.status);
} else if (d.approve_url) {
  console.log("buyer login not provided: stopped after creating the approval link (expected)");
}

await fetch(`${B}/api/demo/reset`, { method: "POST" });
console.log(`\n${pass} passed, ${fail} failed`);
