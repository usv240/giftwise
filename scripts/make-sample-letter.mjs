// Draw the sample letter from Social Security that the "Read her letter" step can read: a made-up notice for a
// fictional person, Sam, who lives in his mother's home and gets $600 a month of Social Security. It is set in
// Giftwise's own type and colours, with no agency logo or letterhead, and says on the page, top and bottom, that it is a
// sample made for this demo and not from Social Security. Its claim number, address and date of birth are placeholders
// (000-00-0000 is never issued), there to show that the reader never returns them.
// Writes public/samples/sam-ssa-letter-sample.png (850 by 1100) and public/samples/sam-ssa-letter-sample.pdf (US Letter,
// with a text layer, so each quote can be checked against the letter's own words).
// Usage: node scripts/make-sample-letter.mjs   (headless Chrome; set CHROME_PATH if it is elsewhere)
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const font = (w) => `data:font/woff2;base64,${readFileSync(`src/app/fonts/ClashGrotesk-${w}.woff2`).toString("base64")}`;
const ROWS = [
  ["Federal SSI amount for one person", "$1,029.00"],
  ["Your Social Security benefit", "$600.00"],
  ["Social Security we count, after the $20 we do not count", "$580.00"],
  ["One-third reduction, because you live in another person's household and receive food and shelter from them", "$343.00"],
];

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Sample letter made for this demo</title>
<style>
@font-face { font-family: Clash; src: url(${font(400)}) format("woff2"); font-weight: 400; }
@font-face { font-family: Clash; src: url(${font(500)}) format("woff2"); font-weight: 500; }
@page { size: Letter; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #fbfbf8; }
body { width: 850px; height: 1100px; padding: 44px 64px 40px; font-family: Clash, system-ui, sans-serif; color: #21232e; font-size: 15px; line-height: 1.45; display: flex; flex-direction: column; }
.banner { background: #dce8ff; color: #0a3a80; border-radius: 12px; padding: 12px 16px; font-weight: 500; font-size: 15px; }
.head { display: flex; justify-content: space-between; align-items: baseline; margin-top: 28px; }
.mark { font-weight: 500; font-size: 15px; color: #5a5d6b; }
h1 { font-weight: 500; font-size: 27px; letter-spacing: -0.02em; line-height: 1.15; margin-top: 10px; }
.to { margin-top: 18px; color: #21232e; display: grid; gap: 1px; }
.to .k { color: #5a5d6b; }
.lead { margin-top: 22px; display: grid; gap: 8px; max-width: 64ch; }
.pay { font-size: 19px; font-weight: 500; }
h2 { font-weight: 500; font-size: 17px; margin-top: 24px; }
table { width: 100%; border-collapse: collapse; margin-top: 8px; }
td { padding: 9px 0; vertical-align: top; border-top: 1px solid #e8eaf0; }
td.n { text-align: right; white-space: nowrap; padding-left: 24px; font-variant-numeric: tabular-nums; }
tr.total td { font-weight: 500; font-size: 17px; border-top: 2px solid #21232e; }
.facts { margin-top: 8px; display: grid; gap: 7px; max-width: 66ch; }
.facts b { font-weight: 500; }
.foot { margin-top: auto; padding-top: 16px; border-top: 1px solid #e8eaf0; color: #5a5d6b; font-size: 13px; }
</style></head>
<body>
<p class="banner">Sample letter made for this demo. Not from Social Security.</p>
<div class="head"><p class="mark">Giftwise sample document</p><p class="mark">November 2, 2026</p></div>
<h1>Notice of your SSI payment amount</h1>
<div class="to">
<p>Sam Rivera</p>
<p>1 Example Lane, Anytown, ST 00000</p>
<p><span class="k">Claim number:</span> 000-00-0000A</p>
<p><span class="k">Date of birth:</span> April 3, 1994</p>
</div>
<div class="lead">
<p>We are writing to tell you about your Supplemental Security Income (SSI) payments.</p>
<p class="pay">Beginning January 2027, the amount you will receive each month is $106.00.</p>
</div>
<h2>How we figured your payment for January 2027</h2>
<table>
${ROWS.map(([k, v]) => `<tr><td>${k}</td><td class="n">${v}</td></tr>`).join("\n")}
<tr class="total"><td>Your monthly SSI payment</td><td class="n">$106.00</td></tr>
</table>
<h2>Information we used</h2>
<div class="facts">
<p><b>Where you live.</b> You live in your mother's household. She provides your food and shelter, and you do not pay your share of the household's expenses.</p>
<p><b>Your income.</b> We counted Social Security benefits of $600.00 a month. You told us you have no wages.</p>
<p><b>Marital status.</b> We pay you as an individual.</p>
</div>
<p class="foot">Sample letter made for this demo. Not from Social Security. Sam, the address, the claim number and every amount are made up for Giftwise.</p>
</body></html>`;

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await browser.newPage({ viewport: { width: 850, height: 1100 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: "public/samples/sam-ssa-letter-sample.png", fullPage: false });
// The PDF is the same page at US Letter size (850 by 1100 CSS pixels is 8.5 by 11 inches at 100 per inch).
await page.pdf({ path: "public/samples/sam-ssa-letter-sample.pdf", width: "8.5in", height: "11in", printBackground: true, scale: 0.96 });
await browser.close();
console.log("public/samples/sam-ssa-letter-sample.png and .pdf written");
