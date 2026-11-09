// How long the long pages are: words in <main> (shown, and with every closed section opened), screens at 1440 by 900
// (the page's height over 900 px, as it first loads, with its sections closed) and the HTML's size. Writes
// content/public/page-measure.json, which the README's docs quote, so a screen count is a measure, never a guess. The
// run it replaces is kept in the same file as `previous`, and each page keeps `before`, its measurement from before its
// last change, so every change in length reads as a before and an after.
//
//   BASE_URL=http://localhost:3100 node scripts/measure-pages.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const FILE = "content/public/page-measure.json";
const last = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : null;
const withoutBefore = (p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== "before"));
const previous = last ? { measured_at: last.measured_at, pages: last.pages.map(withoutBefore) } : undefined;
// Each page keeps its own "before": the last measurement that differs from this one by a fifth of a screen or more, so a
// page that did not change keeps the before and after of its last change, whichever run that was in.
const keep = (p, at) => ({ measured_at: at, words_shown: p.words_shown, words_with_sections_open: p.words_with_sections_open, screens_1440x900: p.screens_1440x900 });
for (const p of pages) {
  const was = last?.pages.find((x) => x.path === p.path);
  const earlier = last?.previous?.pages.find((x) => x.path === p.path);
  const candidates = [was && keep(was, last.measured_at), was?.before, earlier && keep(earlier, last.previous.measured_at)].filter(Boolean);
  const before = candidates.find((c) => Math.abs(c.screens_1440x900 - p.screens_1440x900) >= 0.2);
  if (before) p.before = before;
}
writeFileSync(FILE, JSON.stringify({ measured_at: new Date().toISOString(), base_url: B, viewport: "1440x900", pages, ...(previous ? { previous } : {}) }, null, 2) + "\n");
console.log("written to content/public/page-measure.json");
