import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NOT_LISTED, PRIVATE_PATHS, PUBLIC_PAGES } from "@/lib/site-pages";

vi.mock("next/server", () => ({ connection: async () => undefined }));

/** Every page under src/app, as its route: "src/app/g/[slug]/report/page.tsx" is "/g/[slug]/report". */
function routes(dir = path.resolve("src/app"), base = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name.startsWith("_") || name.startsWith("@")) continue;
      out.push(...routes(full, /^\(.*\)$/.test(name) ? base : `${base}/${name}`));
    } else if (name === "page.tsx") out.push(base || "/");
  }
  return out;
}

const pattern = (route: string) => new RegExp(`^${route.replace(/\[[^\]]+\]/g, "[^/]+")}$`);
const disallowed = (p: string) => PRIVATE_PATHS.some((x) => p.startsWith(x.path));

describe("robots.txt and sitemap.xml cover every page", () => {
  const all = routes();

  it("every page is in the sitemap, kept from crawlers, or named as neither", () => {
    const unclassified = all.filter((r) => {
      if (disallowed(r) || (NOT_LISTED as readonly string[]).includes(r)) return false;
      return !PUBLIC_PAGES.some((p) => pattern(r).test(p));
    });
    // A new page needs a place: add it to PUBLIC_PAGES or PRIVATE_PATHS in src/lib/site-pages.ts.
    expect(unclassified).toEqual([]);
  });

  it("every page in the sitemap exists and may be crawled", () => {
    for (const p of PUBLIC_PAGES) {
      expect(all.some((r) => pattern(r).test(p)), `${p} has no page`).toBe(true);
      expect(disallowed(p), `${p} is disallowed`).toBe(false);
    }
  });

  it("private and per-person pages are kept out: manage links, monthly links, receipts, report checks, keys, the API", () => {
    for (const p of ["/manage/maya-sample-organizer", "/m/abc", "/r/5AB12345XY678901K", "/v/maya/2026-10/ABCD", "/developers/keys", "/api/health", "/ops"]) expect(disallowed(p), p).toBe(true);
    for (const p of ["/", "/evidence", "/g/maya", "/g/maya/report", "/g/maya/calendar", "/dashboard", "/status", "/try"]) expect(disallowed(p), p).toBe(false);
  });
});

describe("the routes Next serves", () => {
  const saved = process.env.RENDER_EXTERNAL_URL;
  beforeAll(() => {
    process.env.RENDER_EXTERNAL_URL = "https://giftwise.example.org/";
  });
  afterAll(() => {
    if (saved === undefined) delete process.env.RENDER_EXTERNAL_URL;
    else process.env.RENDER_EXTERNAL_URL = saved;
  });

  it("/sitemap.xml lists the public and sample pages at the address visitors use", async () => {
    const sitemap = (await import("@/app/sitemap")).default;
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls[0]).toBe("https://giftwise.example.org");
    expect(urls).toContain("https://giftwise.example.org/g/maya");
    expect(urls).toContain("https://giftwise.example.org/g/maya/report");
    expect(urls).toContain("https://giftwise.example.org/evidence");
    expect(urls.every((u) => u.startsWith("https://giftwise.example.org"))).toBe(true);
    expect(urls.some((u) => /\/(r|m|manage|v|api)\//.test(u))).toBe(false);
  });

  it("/robots.txt allows the site, keeps the private paths out, and names the sitemap", async () => {
    const robots = (await import("@/app/robots")).default;
    const r = await robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(expect.arrayContaining(["/api/", "/manage/", "/m/", "/r/", "/v/", "/developers/keys"]));
    expect(r.sitemap).toBe("https://giftwise.example.org/sitemap.xml");
  });
});
