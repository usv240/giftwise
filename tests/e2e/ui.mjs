// Browser end-to-end checks in real Chrome. Prints PASS/FAIL lines.
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const B = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = process.argv[2] ?? ".taste-skill";
const AXE = readFileSync("node_modules/axe-core/axe.min.js", "utf8");
let pass = 0, fail = 0;
// A gift given today counts in the check paid two months later, at that year's rate: $994 in 2026, $1,029 from January 2027 (91 FR 67380).
const PAY = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 2, 1));
const FULL = PAY.getUTCFullYear() >= 2027 ? 1029 : 994;
const ok = (n, c, x = "") => { if (c) pass++; else fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${x ? "  | " + x : ""}`); };
// The four steps where Claude reads a document run live with an AI key, and on Claude's recorded answers without one
// (content/ai-replay); only a server with neither skips them, with this one reason.
const SKIP_WHY = "the server has no AI key and no recorded answers";
const claudeCheck = (await (await fetch(`${B}/api/health`)).json().catch(() => ({}))).checks?.find((c) => c.id === "claude");
const LIVE = claudeCheck?.mode === "live";
const AI = LIVE || Boolean(claudeCheck?.replay);
const skip = (n) => console.log(`SKIP  ${n}  | ${SKIP_WHY}`);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
// Each run reaches the app from an address of its own, so the daily limit on new gift pages for each client is counted
// apart from earlier runs. Only requests to the app carry it; PayPal's own requests are left as they are.
const RUN_FROM = `192.0.2.${1 + (Math.floor(Date.now() / 1000) % 254)}`;
await ctx.route((url) => url.origin === new URL(B).origin, (route) => route.continue({ headers: { ...route.request().headers(), "x-forwarded-for": RUN_FROM } }));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message.slice(0, 140)));
// AG Studio prints its licence notice as console errors until NEXT_PUBLIC_AG_STUDIO_LICENSE_KEY is set; that banner is not an app error.
const AG_LICENCE = /AG Studio [A-Za-z ]*License|License Key Not Found|trial license key|unlocked for trial|^\*+$|^\* .*\*$/;
page.on("console", (m) => { if (m.type() === "error" && !/favicon|paypal|sandbox\.paypal|cookie/i.test(m.text()) && !AG_LICENCE.test(m.text().trim())) errors.push(m.text().slice(0, 140)); });

// 1. Landing: Gift Checker
await page.goto(B + "/", { waitUntil: "networkidle" });
ok("landing has one h1", (await page.locator("h1").count()) === 1);
const fig = page.locator(".checker-figure");
await page.locator(".checker").click({ position: { x: 5, y: 5 } }); // stop the auto-cycle
// The checker prices a gift made today, as Maya's gift page does: the expected checks come from the API for the same date.
const todayPT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
const usdOf = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: Number.isInteger(n) ? 0 : 2 });
const priced = async (gift) => (await (await page.request.post(B + "/api/v1/check-gift", { data: { gift: { date: todayPT, ...gift } }, headers: { "x-forwarded-for": "198.51.100.77" } })).json()).data;
const cash1000 = await priced({ amount: 1000, delivery: "cash", category: "other" });
const shop1000 = await priced({ amount: 1000, delivery: "vendor", category: "equipment" });
const rent1000 = await priced({ amount: 1000, delivery: "vendor", category: "rent", recurring: true });
const rentAble = await priced({ amount: 1000, delivery: "able", category: "rent", recurring: true });
const cash50 = await priced({ amount: 50, delivery: "cash", category: "other" });
await page.getByRole("radio", { name: "Cash to her" }).check();
ok(`Gift Checker cash $1,000 shows ${usdOf(cash1000.check_after)}`, (await fig.textContent()) === usdOf(cash1000.check_after), await fig.textContent());
await page.getByRole("radio", { name: "Pay the shop" }).check();
const shopLine = (await page.locator(".checker-verdict").innerText()).replace(/\s+/g, " ");
ok(`Gift Checker pay the shop shows ${usdOf(shop1000.check_after)}`, (await fig.textContent()) === usdOf(shop1000.check_after), await fig.textContent());
await page.getByRole("radio", { name: "Toward rent" }).check();
ok(
  `Gift Checker rent shows ${usdOf(rent1000.check_after)} and ABLE ${usdOf(rentAble.check_after)}`,
  (await fig.textContent()) === usdOf(rent1000.check_after) && (await page.locator(".checker-alt").textContent()).includes(usdOf(rentAble.check_after)),
  await fig.textContent(),
);
// The same month and the same check Maya's gift page names for a gift made today.
{
  const gp = await ctx.newPage();
  await gp.goto(B + "/g/maya", { waitUntil: "domcontentloaded" });
  const month = (await gp.locator(".gift-k").first().innerText()).match(/January|February|March|April|May|June|July|August|September|October|November|December/)?.[0];
  const check = (await gp.locator(".gift-check").first().innerText()).trim();
  await gp.close();
  ok("Gift Checker names the same month and check as Maya's page", Boolean(month) && shopLine.includes(month) && shopLine.includes(check), `${shopLine} | ${month} ${check}`);
}
await page.getByLabel("Gift amount in dollars").fill("50");
await page.getByRole("radio", { name: "Cash to her" }).check();
ok(`Gift Checker $50 cash stays ${usdOf(cash50.check_after)} (under exclusions)`, (await fig.textContent()) === usdOf(cash50.check_after), await fig.textContent());
await page.getByRole("button", { name: "Show the rule" }).click();
ok("Show the rule lists source links", (await page.locator(".checker-rules a").count()) > 0);

// 2. Info toggletip: hover, click to pin, Escape closes
// Info buttons sit beside the rules they explain (not on titles); the route choice in the Gift Checker has one.
const firstInfo = page.locator('[data-info-id="gift-checker.route"]');
await firstInfo.hover();
await page.waitForTimeout(450);
ok("Info opens on hover", await page.locator(".info-pop").isVisible());
await page.mouse.move(5, 5);
await page.waitForTimeout(300);
await firstInfo.click();
ok("Info pins open on click", await page.locator(".info-pop").isVisible());
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
ok("Info closes on Escape", !(await page.locator(".info-pop").isVisible()));
const infoCount = await page.locator("[data-info-id]").count();
// The seven numbers and their Info buttons live on /learn; the home page keeps one beside the Gift Checker's route, who it is for, and the rule.
ok("landing has an Info button beside each rule it explains", infoCount >= 3, `${infoCount}`);
const missing = await page.$$eval("[data-info-id]", (els) => els.filter((e) => !e.querySelector(".info-dot") || !/^(About|Acerca de) \S/.test(e.getAttribute("aria-label") ?? "")).length);
ok("every Info button renders", missing === 0);

// 3. View menu: Technical mode + Dark theme persist across navigation
await page.getByRole("button", { name: "Display", exact: true }).click();
await page.locator("label", { hasText: "Technical" }).click();
await page.locator("label", { hasText: "Dark" }).click();
await page.keyboard.press("Escape");
ok("Technical mode shows the API trace in the Gift Checker", await page.locator(".checker-tech").isVisible());
await page.goto(B + "/learn", { waitUntil: "networkidle" });
const theme = await page.evaluate(() => document.documentElement.dataset.theme);
const mode = await page.evaluate(() => document.documentElement.dataset.mode);
ok("theme and mode persist to the next page", theme === "dark" && mode === "technical", `${theme}/${mode}`);
ok("Learn shows technical notes in Technical mode", await page.locator(".tech-only").first().isVisible());
await page.screenshot({ path: `${OUT}/ui-learn-dark.png` });
await page.evaluate(() => localStorage.removeItem("gw-prefs"));

// 4. Try: describe tab
await page.goto(B + "/try", { waitUntil: "networkidle" });
// Try prices a gift given today, like the gift page: the check two months on, at that year's rate (FULL, above), less the
// one-off cash gift after the $20 general exclusion and the $60 infrequent or irregular income exclusion.
const afterCash = (gift) => `$${(FULL - (gift - 80)).toLocaleString("en-US")}`;
await page.getByLabel("Amount in dollars").fill("300");
ok(`Try describe: $300 cash today -> ${afterCash(300)}`, (await page.locator(".result-v").first().textContent()) === afterCash(300), await page.locator(".result-v").first().textContent());
await page.getByLabel("Amount in dollars").fill("1,000");
ok(`Try describe: "1,000" is read as $1,000 and shown back (${afterCash(1000)})`, (await page.locator(".result-v").first().textContent()) === afterCash(1000) && (await page.locator("#try-amount-note").textContent()) === "Checking $1,000", await page.locator("#try-amount-note").textContent());
await page.getByLabel("Amount in dollars").fill("abc");
ok("Try describe: text with no number asks for a number and shows no result", (await page.locator(".result-v").count()) === 0 && /like 1000/.test((await page.locator("#try-amount-note").textContent()) ?? ""));
await page.getByLabel("Amount in dollars").fill("300");
await page.locator("select").selectOption("rent");
await page.getByRole("radio", { name: "Pay the shop" }).check();
await page.getByText("The same person gives this every month").click();
const v = await page.locator(".result-v").allTextContents();
ok(`Try describe: monthly rent paid by family shows the lower check and the ABLE route ($${FULL.toLocaleString("en-US")})`, v.includes(`$${FULL.toLocaleString("en-US")}`), JSON.stringify(v));
// A home given as itself (POMS SI 00835.400 F): counted at the presumed maximum value, the same answer the API gives for today.
const homeToday = await priced({ amount: 40000, delivery: "item", category: "mortgage" });
await page.getByLabel("Amount in dollars").fill("40000");
await page.locator("select").selectOption("mortgage");
await page.getByRole("radio", { name: "Give the item" }).check();
await page.getByText("The same person gives this every month").click();
const homeV = await page.locator(".result-v").allTextContents();
ok(`Try describe: a home given as itself lowers her check to ${usdOf(homeToday.check_after)}, with no other route offered`, homeV.length === 1 && homeV[0] === usdOf(homeToday.check_after) && homeToday.check_after < FULL && /A home given outright/.test((await page.locator(".result-plain").textContent()) ?? ""), JSON.stringify(homeV));

// 5. Try: month tab (CSV)
await page.getByRole("tab", { name: "A month of gifts" }).click();
await page.waitForTimeout(300);
ok("Try month: template plan renders", (await page.locator(".month-check").count()) >= 1, `${await page.locator(".month-check").allTextContents()}`);
const tpl = page.getByRole("link", { name: "Download the template" });
const [dl] = await Promise.all([page.waitForEvent("download"), tpl.click()]);
ok("Try month: template downloads", dl.suggestedFilename().endsWith(".csv"), dl.suggestedFilename());
await page.locator("textarea").fill("date,giver,amount,description,paid_to,category,recurring\n2026-13-40,Bad,abc,x,moon,other,no\n");
ok("Try month: bad CSV rows explained", (await page.locator(".try-problems li").count()) >= 1);

// 6. Try: bill tab upload through the UI (live Claude; with no key, the sample bill on Claude's recorded answer)
if (AI) {
  await page.getByRole("tab", { name: "A bill or quote" }).click();
  await page.locator('input[type="file"]').setInputFiles(LIVE ? "public/samples/riverside-mobility-quote.png" : "public/samples/northside-electric-bill.png");
  await page.waitForSelector(".read-card, .ai-json, .result-attention", { timeout: 120000 });
  const billOut = await page.locator(".ai-state").textContent();
  ok("Try bill: upload is read through the UI", (LIVE ? /Riverside Mobility/ : /Northside Electric[\s\S]*Replayed|Replayed[\s\S]*Northside Electric/).test(billOut ?? ""), (billOut ?? "").slice(0, 80));
  ok("Try bill result shows a readable card, not raw JSON", (await page.locator(".ai-json").count()) === 0 && (await page.locator(".read-card").count()) === 1);
} else {
  skip("Try bill: upload is read through the UI");
  skip("Try bill result shows a readable card, not raw JSON");
}

// 7. Presets: view + download
await page.goto(B + "/try/presets/electric-bill", { waitUntil: "networkidle" });
ok("Preset page shows result $876 and ABLE $994", (await page.locator(".result-v").allTextContents()).join(" ").includes("$876"));
const [d2] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download JSON" }).click()]);
ok("Preset JSON downloads", d2.suggestedFilename() === "giftwise-electric-bill.json", d2.suggestedFilename());
const [d3] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Download the sample document" }).click()]);
ok("Preset sample document downloads", d3.suggestedFilename().endsWith(".png"), d3.suggestedFilename());

// 7b. The two reviewers on the Electric bill example: recorded answers, and the wrong-answer test
await page.goto(B + "/try/presets/electric-bill", { waitUntil: "networkidle" });
ok("Electric bill example shows both reviewers with checked quotes", (await page.locator(".rv-card").count()) === 2 && (await page.locator(".rv-check[data-ok]").count()) === 2);
ok("the referee routes it to her ABLE account at $994", /ABLE account.*\$994/.test((await page.locator(".rv-outcome").textContent()) ?? ""));
await page.getByRole("button", { name: "What if a reviewer gets it wrong?" }).click();
ok("a made-up quote is set aside and her check stays $994", (await page.locator(".rv-card[data-set-aside]").count()) === 1 && /\$994/.test((await page.locator(".rv-outcome").textContent()) ?? "") && /\$876/.test((await page.locator(".rv-trusted").textContent()) ?? ""));

// 7c. A fundraiser becomes a gift page: Claude reads the sample, the form makes a page with every need payable
if (AI) {
  await page.goto(B + "/try", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "A fundraiser page" }).click();
  await page.getByRole("button", { name: "Use the sample fundraiser" }).click();
  await page.locator(".make-page").waitFor({ timeout: 120000 });
  const uses = await page.locator(".make-need").count();
  await page.getByLabel("Their first name").fill("Maya");
  await page.getByLabel("she/her").check();
  await page.getByLabel("Your name (optional)").fill("E2E");
  await page.getByRole("button", { name: "Make the gift page" }).click();
  // A new page opens the organizer's private manage link first, then the page givers see.
  await page.waitForURL(/\/manage\/[A-Za-z0-9_-]{24}\?new=1$/, { timeout: 60000, waitUntil: "commit" });
  await page.getByText("Keep this link").waitFor({ timeout: 60000 });
  const managedNeeds = await page.locator(".mg-need").count();
  await page.getByRole("link", { name: "Open the page givers see" }).click();
  await page.waitForURL(/\/g\/maya-[0-9a-f]{6}$/, { timeout: 60000, waitUntil: "commit" });
  await page.locator(".need").first().waitFor({ timeout: 60000 });
  ok("fundraiser becomes a live gift page with every use as a payable need, managed from its own private link", uses >= 2 && managedNeeds === uses && (await page.locator(".need").count()) === uses, `${uses} uses, ${managedNeeds} managed`);
} else skip("fundraiser becomes a live gift page with every use as a payable need, managed from its own private link");

// 7d. For AI agents: the recorded conversation shows June, the assistant, and each Giftwise tool it called over MCP
await page.goto(B + "/agents", { waitUntil: "networkidle" });
const tools = await page.locator(".ag-tool").allTextContents();
ok("For agents page shows the assistant calling Giftwise tools, starting a checkout June approves, then reading the order from PayPal", (await page.locator(".ag-ask").count()) === 2 && tools.includes("check_gift") && tools.indexOf("start_gift_checkout") >= 0 && tools.at(-1) === "paypal_get_order", tools.join(","));

// 7e. Maya's year in AG Studio: the Giftwise widget runs the rules engine, and reruns when a giver filter is pressed
await page.goto(B + "/dashboard", { waitUntil: "load" });
// The widget renders once AG Studio hands it the rows; when it does not appear, the two checks below fail and the suite goes on.
const widgetShown = await page.locator(".gw-check").waitFor({ timeout: 90000 }).then(() => true).catch(() => false);
const allYear = widgetShown ? (await page.locator(".gw-check").innerText()).replace(/\s+/g, " ") : "";
ok("dashboard widget: $994 every month with Giftwise, far lower as cash", /\$994 Every month, \d+ months/.test(allYear) && /dropped to \$0/.test(allYear), allYear.slice(0, 90));
await page.locator(".fd-studio button").filter({ hasText: /^Dan$/ }).first().click();
await page.waitForFunction(() => /5 months in view/.test(document.querySelector(".gw-check")?.textContent ?? ""), null, { timeout: 15000 }).catch(() => {});
const danOnly = (await page.locator(".gw-check").count()) ? (await page.locator(".gw-check").innerText()).replace(/\s+/g, " ") : "";
ok("filtering to one giver reruns the rules engine on just those gifts", /5 months in view/.test(danOnly) && danOnly !== allYear, danOnly.slice(0, 90));
await page.getByRole("button", { name: "Edit the dashboard" }).click();
ok("edit mode opens the AG Studio assistant with Giftwise prompt starters", await page.getByRole("button", { name: "What if it were cash?" }).isVisible({ timeout: 15000 }).catch(() => false));

// 7f. For organizations: the fund's live PayPal balance, and a grant routed before anything is sent (no payout here)
await page.goto(B + "/organizations", { waitUntil: "load" });
await page.locator(".org-household").first().waitFor({ timeout: 60000 });
ok("organizations page shows the fund's PayPal balance", /\$[\d,]+/.test((await page.locator(".org-balance").textContent()) ?? ""));
await page.getByLabel("Grant to Maya in dollars").fill("120");
ok("Send stays closed until the preview has shown where each dollar goes", await page.getByRole("button", { name: /^Send .* as one PayPal payout batch$/ }).isDisabled());
await page.getByRole("button", { name: "Preview where each dollar goes" }).click();
await page.locator(".org-plans").waitFor({ timeout: 30000 });
ok(`a $120 grant is routed so her check stays $${FULL}`, new RegExp(`Check stays \\$${FULL.toLocaleString("en-US")}`).test((await page.locator(".org-plans").innerText()) ?? ""));

// 8. Gift page: PayPal buttons, reset link
await page.goto(B + "/g/maya", { waitUntil: "networkidle" });
// PayPal loads at the first sign of a person, or about 3 seconds after the page loads; wait for it rather than a fixed time.
await page.waitForFunction(() => [...document.querySelectorAll("paypal-button")].some((e) => !e.hasAttribute("hidden")), null, { timeout: 15000 }).catch(() => {});
const visibleButtons = await page.$$eval("paypal-button", (els) => els.filter((e) => !e.hasAttribute("hidden")).length);
ok("Gift page renders a live PayPal button per open need", visibleButtons >= 1, `${visibleButtons}`);
const realQs = page.locator(".rw-item");
await realQs.first().locator("summary").click();
const realFirst = await realQs.first().innerText();
ok("How this works for real: five questions, each opens with its sources", (await realQs.count()) === 5 && /business account/.test(realFirst) && (await realQs.first().locator(".rw-src a").count()) >= 2, realFirst.slice(0, 80));

// 8b. The benefit calendar (Bryntum): gifts on their days, and moving a cash gift into the next month moves it to a later check
await page.goto(B + "/g/maya/calendar", { waitUntil: "networkidle" });
await page.locator(".b-cal-event").first().waitFor({ timeout: 60000 }).catch(() => {});
const calEvents = await page.locator(".b-cal-event").count();
await page.getByRole("button", { name: "As cash" }).click();
const lastOpt = (await page.locator(".bc-move select option").count()) - 1;
await page.locator(".bc-move select").selectOption({ index: lastOpt });
await page.locator(".bc-move input[type=date]").fill("2026-11-02");
await page.getByRole("button", { name: "Move it" }).click();
const moved = (await page.locator(".bc-moves").innerText()).replace(/\s+/g, " ");
ok("Benefit calendar shows the gifts, and moving a cash gift into November changes which check it lowers", calEvents >= 5 && /check \$[\d,.]+ to \$[\d,.]+/.test(moved), `${calEvents} events; ${moved.slice(0, 120)}`);

// 8c. The gift page in Spanish: the page, a need's rule, the giving card's split and the check, all in Spanish.
// PayPal's SDK (with its guest card form) loads at once when the pointer is already over the page, and its frames keep
// the network from going idle, so this step waits for the page's own giving card instead.
await page.goto(B + "/g/maya?lang=es", { waitUntil: "load" });
await page.locator(".give-input").waitFor({ timeout: 30000 });
await page.locator(".give-input").fill("1500");
await page.waitForTimeout(400);
const es = (await page.locator("main").innerText()).replace(/\s+/g, " ");
ok(
  "Spanish gift page: title, a need's rule, the split and the check are in Spanish, and the switch leads back to English",
  /Ayude a Maya/.test(es) && /Reparación de la silla de ruedas/.test(es) && /Su cheque de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) de \d{4} se mantiene en \$[\d,]+/.test(es) && /Giftwise lo envía aquí/.test(es) && (await page.locator(".give-seg").count()) >= 2 && (await page.locator('a.gift-lang[hreflang="en"]').count()) === 1,
  es.slice(0, 120),
);

// 8d. The guided tour from /evidence: eight stops across six pages, each with its element ringed, and Finish closes it.
await page.goto(B + "/evidence", { waitUntil: "networkidle" });
// The tour starts inside the path's disclosure ("What to look for at each step"), one press below the ninety-second version.
await page.locator("#path-detail > summary").click();
await page.getByRole("button", { name: "Take the guided tour" }).click();
const stops = [];
for (let i = 0; i < 8; i++) {
  await page.waitForFunction((n) => document.querySelector(".tour-k")?.textContent?.includes(`stop ${n} of`), i + 1, { timeout: 30000 });
  await page.locator("[data-tour-target]").first().waitFor({ timeout: 30000 }).catch(() => {});
  stops.push(`${new URL(page.url()).pathname}:${await page.locator("[data-tour-target]").count()}`);
  await page.locator(".tour").getByRole("button", { name: i === 7 ? "Finish" : "Next", exact: true }).click();
}
await page.waitForTimeout(300);
ok("guided tour: eight stops, each page's element ringed, and Finish closes the card", stops.length === 8 && stops.every((x) => x.endsWith(":1")) && (await page.locator(".tour").count()) === 0, stops.join(" "));

// 8e. The calendar's planner: as cash, it moves gifts on the Bryntum calendar itself and says what that kept.
await page.goto(B + "/g/maya/calendar?month=2026-10", { waitUntil: "networkidle" });
await page.locator(".b-cal-event").first().waitFor({ timeout: 60000 }).catch(() => {});
await page.getByRole("button", { name: "As cash" }).click();
await page.getByRole("button", { name: "Plan the cash dates" }).click();
await page.waitForFunction(() => /The planner moved \d+ cash/.test(document.querySelector(".bc-planner-text")?.textContent ?? ""), null, { timeout: 60000 });
const planned = (await page.locator(".bc-planner-text").innerText()).replace(/\s+/g, " ");
ok("calendar planner: moves cash gifts by a week or less, keeps more of the checks, and compares it with paying the shop", /kept \$[\d,.]+ more/.test(planned) && /Paying the shop instead keeps \$[\d,.]+ more/.test(planned) && (await page.locator(".bc-moves li").filter({ hasText: "The planner moved" }).count()) >= 1, planned.slice(0, 160));

// 9. Header links: which pages are missing
const hrefs = [...new Set(await page.$$eval("header a, footer a", (as) => as.map((a) => a.getAttribute("href")).filter((h) => h && h.startsWith("/"))))];
const broken = [];
for (const h of hrefs) {
  const r = await page.request.get(B + h.split("#")[0]);
  if (r.status() >= 400) broken.push(h);
}
ok("all header and footer links resolve", broken.length === 0, `broken: ${broken.join(", ")}`);

// 10. Keyboard: skip link and focus ring
await page.goto(B + "/", { waitUntil: "networkidle" });
await page.keyboard.press("Tab");
const first = await page.evaluate(() => document.activeElement?.textContent?.trim());
ok("first Tab reaches the skip link", first === "Skip to content", first);

// 11. Accessibility scan (axe) on main routes, light and dark, desktop and phone
for (const [route, w] of [["/", 1440], ["/try", 1440], ["/learn", 1440], ["/g/maya", 1440], ["/", 390], ["/g/maya", 390]]) {
  for (const th of ["light", "dark"]) {
    const p = await ctx.newPage();
    await p.setViewportSize({ width: w, height: 900 });
    await p.goto(`${B}${route}?theme=${th}`, { waitUntil: "networkidle" });
    await p.addScriptTag({ content: AXE });
    const res = await p.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] });
      return r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}(${v.nodes.length}): ${v.nodes[0]?.target?.join(" ")}`);
    });
    ok(`axe ${route} ${w}px ${th}: no serious or critical issues`, res.length === 0, res.join("; ").slice(0, 300));
    await p.close();
  }
}

// 12. Developers: request a key, see it once, send a first request with it, then upload the sample bill
await page.goto(B + "/developers", { waitUntil: "networkidle" });
await page.getByLabel("Name").fill("UI test");
await page.getByLabel("Email").fill(`ui-${Date.now()}@example.com`);
await page.getByLabel(/I understand sandbox keys/).check();
await page.getByRole("button", { name: "Get an API key" }).click();
const shown = (await page.locator(".dev-key").textContent({ timeout: 15000 })) ?? "";
ok("developer key revealed once, gw_test_ format", /^gw_test_[0-9A-Za-z]{43}$/.test(shown), shown.slice(0, 12));
await page.getByRole("button", { name: "Send your first request" }).click();
ok("first-request button fills the key into the playground", (await page.getByLabel("API key (optional)").inputValue()) === shown);
await page.getByRole("button", { name: "Send request" }).click();
await page.locator(".dev-code-badge").waitFor({ timeout: 15000 });
ok("playground request with the key returns 200 and a request id", (await page.locator(".dev-code-badge").textContent()) === "200" && /req_/.test(await page.locator(".dev-status").textContent()));
ok("code sample carries the key", (await page.locator(".dev-snip pre").textContent()).includes(shown));
if (AI) {
  await page.getByRole("radio", { name: "Read a bill" }).click();
  await page.getByRole("button", { name: "Send request" }).click();
  await page.waitForFunction(() => document.querySelector(".dev-out pre")?.textContent?.includes("request_id"), null, { timeout: 90000 });
  const bill = await page.locator(".dev-out pre").first().textContent();
  ok("playground uploads the sample bill and Claude reads it", (await page.locator(".dev-code-badge").textContent()) === "200" && /utility|electric/i.test(bill), (await page.locator(".dev-code-badge").textContent()) ?? "");
} else skip("playground uploads the sample bill and Claude reads it");
await page.goto(B + "/developers/keys", { waitUntil: "networkidle" });
await page.locator(".usage-key").first().waitFor({ timeout: 15000 });
ok("usage page lists the key with its calls", (await page.locator(".usage-key").first().textContent()).includes(shown.slice(0, 12)) && (await page.locator(".doc-table tbody tr").count()) >= (AI ? 2 : 1));

ok("no JavaScript errors in the browser", errors.length === 0, errors.slice(0, 3).join(" || "));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
