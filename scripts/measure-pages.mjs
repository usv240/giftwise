// How long the long pages are: words in <main> (shown, and with every closed section opened), screens at 1440 by 900
// (the page's height over 900 px, as it first loads, with its sections closed) and the HTML's size. Writes
// content/public/page-measure.json, which the README's docs quote, so a screen count is a measure, never a guess.
//
//   BASE_URL=http://localhost:3100 node scripts/measure-pages.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const B = process.env.BASE_URL ?? "http://localhost:3100";
const PAGES = ["/", "/evidence", "/evidence/rules", "/evidence/operations", "/evidence/impact", "/about", "/g/maya"];

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const pages = [];
for (const path of PAGES) {
  const res = await page.goto(B + path, { waitUntil: "networkidle", timeout: 90_000 });
  const html = await res.text();
  await page.waitForTimeout(500);
  const m = await page.evaluate(() => {
    const main = document.querySelector("main") ?? document.body;
    const count = (s) => (s.replace(/\s+/g, " ").match(/[A-Za-z0-9$][^\s]*/g) ?? []).length;
    return { shown: count(main.innerText), all: count(main.textContent ?? ""), height: document.documentElement.scrollHeight };
  });
  pages.push({ path, words_shown: m.shown, words_with_sections_open: m.all, screens_1440x900: Number((m.height / 900).toFixed(1)), html_kb: Math.round(Buffer.byteLength(html) / 1024) });
  console.log(JSON.stringify(pages.at(-1)));
}
await browser.close();
mkdirSync("content/public", { recursive: true });
writeFileSync("content/public/page-measure.json", JSON.stringify({ measured_at: new Date().toISOString(), base_url: B, viewport: "1440x900", pages }, null, 2) + "\n");
console.log("written to content/public/page-measure.json");
