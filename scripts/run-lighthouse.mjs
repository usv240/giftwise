/**
 * Lighthouse on the pages a judge opens first, phone (Lighthouse's mobile preset) and desktop, written to
 * content/lighthouse.json for /judges. BASE_URL=https://giftwise-405i.onrender.com node scripts/run-lighthouse.mjs
 * measures the hosted demo; without it, the local production build on port 3100.
 * Runs Lighthouse through npx so it is not a project dependency.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = (process.env.BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PAGES = [
  { path: "/", name: "Home" },
  { path: "/g/maya", name: "Maya's gift page" },
  { path: "/g/maya/report?month=2026-10", name: "Her report to Social Security" },
  { path: "/g/maya/report/easy?month=2026-10&lang=es", name: "Her Easy Read report, in Spanish" },
  { path: "/judges", name: "For judges" },
];
const CATS = ["performance", "accessibility", "best-practices", "seo"];
const dir = mkdtempSync(join(tmpdir(), "lh-"));

const results = [];
for (const p of PAGES) {
  for (const form of ["mobile", "desktop"]) {
    const out = join(dir, `${results.length}.json`);
    const args = ["-y", "lighthouse@13.6.0", `${BASE}${p.path}`, "--quiet", "--output=json", `--output-path=${out}`, `--only-categories=${CATS.join(",")}`, "--chrome-flags=--headless=new --no-sandbox"];
    if (form === "desktop") args.push("--preset=desktop");
    execFileSync(process.platform === "win32" ? "npx.cmd" : "npx", args, { stdio: "inherit", shell: process.platform === "win32", env: { ...process.env, CHROME_PATH: CHROME } });
    const r = JSON.parse(readFileSync(out, "utf8"));
    const scores = Object.fromEntries(CATS.map((c) => [c, Math.round((r.categories[c]?.score ?? 0) * 100)]));
    results.push({ ...p, form, scores });
    console.log(`${form.padEnd(7)} ${p.path.padEnd(44)} ${CATS.map((c) => `${c} ${scores[c]}`).join("  ")}`);
  }
}
writeFileSync("content/lighthouse.json", JSON.stringify({ ran_at: new Date().toISOString(), base: BASE, lighthouse: "13.6.0", pages: results }, null, 2) + "\n");
