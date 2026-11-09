// Click the real PayPal buttons on the gift page and confirm PayPal checkout opens for our order.
// If SANDBOX_BUYER_EMAIL and SANDBOX_BUYER_PASSWORD are set, it also logs in as the sandbox buyer,
// approves, and checks the capture on the page, at PayPal, and on the public receipt (full flow).
import { chromium } from "playwright-core";
import { transcript } from "./transcript.mjs";

const B = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = process.argv[2] ?? ".taste-skill";
const email = process.env.SANDBOX_BUYER_EMAIL, pass = process.env.SANDBOX_BUYER_PASSWORD;
let pass_ = 0, fail = 0;
// Each PayPal step is written to content/eval/e2e-transcripts.json with its order and capture ids, redacted.
const T = transcript("paypal", B);
const ok = (n, c, x = "") => { if (c) pass_++; else fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? "  | " + x : ""}`); T.step(n, { ok: c }); };
/** PayPal's view of an order: its status and every capture id, for the transcript. */
async function captured(id) {
  const j = await (await fetch(`${B}/api/paypal/orders/${id}`)).json();
  return { paypal_status: j.data?.status ?? j.error?.code, capture_ids: (j.data?.units ?? []).flatMap((u) => u.captures.map((c) => c.id)), payees: j.data?.units?.length };
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await fetch(`${B}/api/demo/reset`, { method: "POST" });

/** Log in as the sandbox buyer if PayPal asks, then press the pay button. */
async function approve(popup, tag) {
  await popup.waitForLoadState("domcontentloaded");
  const emailBox = popup.locator('input#email, input[type="email"]').first();
  const passBox = popup.locator('input#password, input[type="password"]').first();
  const payBtn = popup.locator('button[data-testid="submit-button-initial"], button#payment-submit-btn, button:has-text("Complete Purchase"), button:has-text("Pay Now"), button:has-text("Continue to Review Order")').first();
  // A second checkout in the same browser can skip the login; wait for whichever screen comes first.
  await Promise.race([emailBox.waitFor({ timeout: 45000 }), passBox.waitFor({ timeout: 45000 }), payBtn.waitFor({ timeout: 45000 })]).catch(() => {});
  if (await emailBox.isVisible().catch(() => false)) {
    await emailBox.fill(email);
    const next = popup.locator("button#btnNext");
    if (await next.isVisible().catch(() => false)) await next.click();
  }
  if (await passBox.isVisible({ timeout: 10000 }).catch(() => false) || (await passBox.waitFor({ timeout: 10000 }).then(() => true).catch(() => false))) {
    await passBox.fill(pass);
    await popup.locator("button#btnLogin").click();
  }
  await payBtn.waitFor({ timeout: 60000 });
  await popup.screenshot({ path: `${OUT}/pp-${tag}-review.png` });
  ok(`${tag} checkout asks the donor for no shipping address`, (await popup.getByText(/Ship to/i).count()) === 0);
  await payBtn.click();
}

/** The popup starts on about:blank; wait until it reaches PayPal with our order's token. */
async function opensFor(popup, id) {
  if (!popup || !id) return false;
  return popup.waitForURL((u) => u.href.includes(id), { timeout: 30000 }).then(() => new URL(popup.url()).host.endsWith("paypal.com")).catch(() => false);
}

/** The order at PayPal, through our own check endpoint. */
async function checkAtPayPal(id) {
  const r = await fetch(`${B}/api/paypal/orders/${id}`);
  const j = await r.json();
  return j.data?.status ?? j.error?.code;
}

// 1. One need: the card's PayPal button.
await page.goto(`${B}/g/maya`, { waitUntil: "networkidle" });
await page.waitForFunction(() => document.querySelectorAll(".need paypal-button:not([hidden])").length > 0, null, { timeout: 30000 });
const orderReq = page.waitForResponse((r) => r.url().endsWith("/api/paypal/orders") && r.request().method() === "POST");
const popupP = ctx.waitForEvent("page", { timeout: 30000 }).catch(() => null);
// Pin the card by its id: once paid it has no button, so a "card with a button" filter would lose it.
const cardId = await page.locator(".need").filter({ has: page.locator("paypal-button:not([hidden])") }).first().getAttribute("aria-labelledby");
const card = page.locator(`.need[aria-labelledby="${cardId}"]`);
const cardTitle = (await card.locator(".need-title").textContent())?.trim();
await card.locator("paypal-button").click();
const orderJson = await (await orderReq).json();
const orderId = orderJson.data?.id;
ok("need button creates an order", Boolean(orderId), `${cardTitle}: ${orderId}`);
T.step("the need order, as created", { order_id: orderId, payees: 1, status: orderJson.data?.status, amount: orderJson.data?.amount });
const popup = await popupP;
ok("PayPal checkout opens for that order", await opensFor(popup, orderId));

if (popup && email && pass) {
  await approve(popup, "need");
  await card.locator(".need-receipt").waitFor({ timeout: 90000 });
  const line = (await card.locator(".need-receipt").textContent())?.replace(/\s+/g, " ").trim();
  ok("card shows it paid, with the buyer's name", /Paid by \S+/.test(line ?? ""), line);
  await page.screenshot({ path: `${OUT}/pp-need-paid.png` });
  ok("PayPal says the need order is COMPLETED", (await checkAtPayPal(orderId)) === "COMPLETED");
  T.step("PayPal's record of the need order", { order_id: orderId, ...(await captured(orderId)) });
  const rc = await page.request.get(`${B}/r/${orderId}`);
  ok("public receipt for the need order", rc.status() === 200 && (await rc.text()).includes("rc-total"));
} else if (popup) {
  console.log("buyer login not provided: stopped at the PayPal login screen (expected)");
  await popup.close();
}

// 2. Give any amount: ONE order split across payees, approved once.
await page.goto(`${B}/g/maya`, { waitUntil: "networkidle" });
await page.waitForFunction(() => document.querySelector(".give-any paypal-button:not([hidden])"), null, { timeout: 30000 });
await page.locator(".give-input").fill("1500");
const preview = (await page.locator(".give-any .give-lines").textContent())?.replace(/\s+/g, " ");
console.log("routing preview:", preview);
const giftReq = page.waitForResponse((r) => r.url().endsWith("/api/paypal/gift-orders") && r.request().method() === "POST");
const giftPopupP = ctx.waitForEvent("page", { timeout: 30000 }).catch(() => null);
await page.locator(".give-any paypal-button").click();
const giftJson = await (await giftReq).json();
const giftId = giftJson.data?.id;
const units = giftJson.data?.plan?.lines?.length ?? 0;
ok("Give any amount creates one routed order", Boolean(giftId) && units > 1, `${giftId}, ${units} payees`);
T.step("the routed order, as created", { order_id: giftId, payees: units, status: giftJson.data?.status, amount: giftJson.data?.plan?.amount });
const giftPopup = await giftPopupP;
ok("PayPal checkout opens for the routed order", await opensFor(giftPopup, giftId));

if (giftPopup && email && pass) {
  await approve(giftPopup, "routed");
  await page.locator(".give-done").waitFor({ timeout: 90000 });
  const done = (await page.locator(".give-any").textContent())?.replace(/\s+/g, " ").trim();
  const shown = await page.locator(".give-any .give-lines li").count();
  ok("thank-you shows every payee captured", shown === units, `${shown} of ${units}: ${done?.slice(0, 160)}`);
  const thanked = (await page.locator(".give-any .give-lines").textContent())?.replace(/\s+/g, " ");
  ok("thank-you lists the same lines, in the same order, as the preview", thanked === preview, thanked);
  const refreshed = await page.waitForFunction(() => document.querySelectorAll(".need paypal-button").length === 0, null, { timeout: 20000 }).then(() => true).catch(() => false);
  ok("needs the gift covered show as paid without a reload", refreshed);
  await page.screenshot({ path: `${OUT}/pp-routed-paid.png` });
  ok("PayPal says the routed order is COMPLETED", (await checkAtPayPal(giftId)) === "COMPLETED");
  T.step("PayPal's record of the routed order", { order_id: giftId, ...(await captured(giftId)) });
  await page.goto(`${B}/r/${giftId}`, { waitUntil: "networkidle" });
  const rows = await page.locator(".rc-line").count();
  ok("public receipt lists every payee", rows === units, `${rows} of ${units}`);
  await page.screenshot({ path: `${OUT}/pp-routed-receipt.png`, fullPage: true });
} else if (giftPopup) {
  await giftPopup.close();
}

await fetch(`${B}/api/demo/reset`, { method: "POST" });
T.save(pass_, fail);
console.log(`\n${pass_} passed, ${fail} failed`);
await browser.close();
