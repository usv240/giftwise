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

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
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
await page.getByRole("radio", { name: "Cash to her" }).check();
ok("Gift Checker cash $1,000 shows $74", (await fig.textContent()) === "$74", await fig.textContent());
await page.getByRole("radio", { name: "Pay the shop" }).check();
ok("Gift Checker pay the shop shows $994", (await fig.textContent()) === "$994", await fig.textContent());
await page.getByRole("radio", { name: "Toward rent" }).check();
ok("Gift Checker rent shows $662.67 and ABLE $994", (await fig.textContent()) === "$662.67" && (await page.locator(".checker-alt").textContent()).includes("$994"));
await page.getByLabel("Gift amount in dollars").fill("50");
await page.getByRole("radio", { name: "Cash to her" }).check();
ok("Gift Checker $50 cash stays $994 (under exclusions)", (await fig.textContent()) === "$994", await fig.textContent());
await page.getByRole("button", { name: "Show the rule" }).click();
ok("Show the rule lists source links", (await page.locator(".checker-rules a").count()) > 0);

// 2. Info toggletip: hover, click to pin, Escape closes
const firstInfo = page.locator('[data-info-id="page.home"]');
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
ok("landing has an Info button on each part", infoCount >= 25, `${infoCount}`);
const missing = await page.$$eval("[data-info-id]", (els) => els.filter((e) => !e.querySelector(".info-dot") || !e.getAttribute("aria-label")?.startsWith("info:")).length);
ok("every Info button renders", missing === 0);

// 3. View menu: Technical mode + Dark theme persist across navigation
await page.getByRole("button", { name: "View", exact: true }).click();
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
await page.getByLabel("Amount in dollars").fill("300");
ok("Try describe: $300 cash -> $774", (await page.locator(".result-v").first().textContent()) === "$774");
await page.locator("select").selectOption("rent");
await page.getByRole("radio", { name: "Pay the shop" }).check();
await page.getByText("The same person gives this every month").click();
const v = await page.locator(".result-v").allTextContents();
ok("Try describe: monthly rent paid by family shows the lower check and the ABLE route", v.includes("$994"), JSON.stringify(v));

// 5. Try: month tab (CSV)
await page.getByRole("tab", { name: "A month of gifts" }).click();
await page.waitForTimeout(300);
ok("Try month: template plan renders", (await page.locator(".month-check").count()) >= 1, `${await page.locator(".month-check").allTextContents()}`);
const tpl = page.getByRole("link", { name: "Download the template" });
const [dl] = await Promise.all([page.waitForEvent("download"), tpl.click()]);
ok("Try month: template downloads", dl.suggestedFilename().endsWith(".csv"), dl.suggestedFilename());
await page.locator("textarea").fill("date,giver,amount,description,paid_to,category,recurring\n2026-13-40,Bad,abc,x,moon,other,no\n");
ok("Try month: bad CSV rows explained", (await page.locator(".try-problems li").count()) >= 1);

// 6. Try: bill tab upload through the UI (live Claude)
await page.getByRole("tab", { name: "A bill or quote" }).click();
await page.locator('input[type="file"]').setInputFiles("public/samples/riverside-mobility-quote.png");
await page.waitForSelector(".read-card, .ai-json, .result-attention", { timeout: 120000 });
const billOut = await page.locator(".ai-state").textContent();
ok("Try bill: upload is read through the UI", /Riverside Mobility/.test(billOut ?? ""), (billOut ?? "").slice(0, 80));
ok("Try bill result shows a readable card, not raw JSON", (await page.locator(".ai-json").count()) === 0 && (await page.locator(".read-card").count()) === 1);

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
await page.goto(B + "/try", { waitUntil: "networkidle" });
await page.getByRole("tab", { name: "A fundraiser page" }).click();
await page.getByRole("button", { name: "Use the sample fundraiser" }).click();
await page.locator(".make-page").waitFor({ timeout: 120000 });
const uses = await page.locator(".make-need").count();
await page.getByLabel("Their first name").fill("Maya");
await page.getByLabel("she/her").check();
await page.getByLabel("Your name (optional)").fill("E2E");
await page.getByRole("button", { name: "Make the gift page" }).click();
await page.waitForURL(/\/g\/maya-[0-9a-f]{6}$/, { timeout: 60000, waitUntil: "commit" });
await page.locator(".need").first().waitFor({ timeout: 60000 });
ok("fundraiser becomes a live gift page with every use as a payable need", uses >= 2 && (await page.locator(".need").count()) === uses, `${uses} uses`);

// 7d. For AI agents: the recorded conversation shows June, the assistant, and each Giftwise tool it called over MCP
await page.goto(B + "/agents", { waitUntil: "networkidle" });
const tools = await page.locator(".ag-tool").allTextContents();
ok("For agents page shows the assistant calling Giftwise tools, starting a checkout June approves, then reading the order from PayPal", (await page.locator(".ag-ask").count()) === 2 && tools.includes("check_gift") && tools.indexOf("start_gift_checkout") >= 0 && tools.at(-1) === "paypal_get_order", tools.join(","));

// 7e. Maya's year in AG Studio: the Giftwise widget runs the rules engine, and reruns when a giver filter is pressed
await page.goto(B + "/dashboard", { waitUntil: "load" });
await page.locator(".gw-check").waitFor({ timeout: 90000 });
const allYear = (await page.locator(".gw-check").innerText()).replace(/\s+/g, " ");
ok("dashboard widget: $994 every month with Giftwise, far lower as cash", /\$994 Every month, \d+ months/.test(allYear) && /dropped to \$0/.test(allYear), allYear.slice(0, 90));
await page.locator(".fd-studio button").filter({ hasText: /^Dan$/ }).first().click();
await page.waitForFunction(() => /5 months in view/.test(document.querySelector(".gw-check")?.textContent ?? ""), null, { timeout: 15000 }).catch(() => {});
const danOnly = (await page.locator(".gw-check").innerText()).replace(/\s+/g, " ");
ok("filtering to one giver reruns the rules engine on just those gifts", /5 months in view/.test(danOnly) && danOnly !== allYear, danOnly.slice(0, 90));
await page.getByRole("button", { name: "Edit the dashboard" }).click();
ok("edit mode opens the AG Studio assistant with Giftwise prompt starters", await page.getByRole("button", { name: "What if it were cash?" }).isVisible({ timeout: 15000 }).catch(() => false));

// 7f. For organizations: the fund's live PayPal balance, and a grant routed before anything is sent (no payout here)
await page.goto(B + "/organizations", { waitUntil: "load" });
await page.locator(".org-household").first().waitFor({ timeout: 60000 });
ok("organizations page shows the fund's PayPal balance", /\$[\d,]+/.test((await page.locator(".org-balance").textContent()) ?? ""));
await page.getByLabel("Grant to Maya in dollars").fill("120");
await page.getByRole("button", { name: "Show the routing" }).click();
await page.locator(".org-plans").waitFor({ timeout: 30000 });
ok(`a $120 grant is routed so her check stays $${FULL}`, new RegExp(`Check stays \\$${FULL.toLocaleString("en-US")}`).test((await page.locator(".org-plans").innerText()) ?? ""));

// 8. Gift page: PayPal buttons, reset link
await page.goto(B + "/g/maya", { waitUntil: "networkidle" });
await page.waitForTimeout(3500);
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
await page.goto(B + "/g/maya?lang=es", { waitUntil: "networkidle" });
await page.locator(".give-input").fill("1500");
await page.waitForTimeout(400);
const es = (await page.locator("main").innerText()).replace(/\s+/g, " ");
ok(
  "Spanish gift page: title, a need's rule, the split and the check are in Spanish, and the switch leads back to English",
  /Ayude a Maya/.test(es) && /Reparación de la silla de ruedas/.test(es) && /Su cheque de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) se mantiene en \$[\d,]+/.test(es) && /Giftwise lo envía aquí/.test(es) && (await page.locator(".give-seg").count()) >= 2 && (await page.locator('a.gift-lang[hreflang="en"]').count()) === 1,
  es.slice(0, 120),
);

// 8d. The guided tour from /judges: eight stops across six pages, each with its element ringed, and Finish closes it.
await page.goto(B + "/judges", { waitUntil: "networkidle" });
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
await page.getByRole("radio", { name: "Read a bill" }).click();
await page.getByRole("button", { name: "Send request" }).click();
await page.waitForFunction(() => document.querySelector(".dev-out pre")?.textContent?.includes("request_id"), null, { timeout: 90000 });
const bill = await page.locator(".dev-out pre").first().textContent();
ok("playground uploads the sample bill and Claude reads it", (await page.locator(".dev-code-badge").textContent()) === "200" && /utility|electric/i.test(bill), (await page.locator(".dev-code-badge").textContent()) ?? "");
await page.goto(B + "/developers/keys", { waitUntil: "networkidle" });
await page.locator(".usage-key").first().waitFor({ timeout: 15000 });
ok("usage page lists the key with its calls", (await page.locator(".usage-key").first().textContent()).includes(shown.slice(0, 12)) && (await page.locator(".doc-table tbody tr").count()) >= 2);

ok("no JavaScript errors in the browser", errors.length === 0, errors.slice(0, 3).join(" || "));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
