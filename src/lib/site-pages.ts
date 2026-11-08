import { PRESETS } from "./presets";

/**
 * Which pages search engines are pointed to (/sitemap.xml) and which they are asked to leave alone (/robots.txt).
 * Public pages and the sample household's pages are listed; anything made for one person (an organizer's or giver's
 * private link, a receipt, a report's check page, a developer's own keys) and the API are not. tests/site-pages.test.ts
 * fails when a page under src/app is in neither list.
 */

/** Pages anyone can read, and the sample household Maya's pages. */
export const PUBLIC_PAGES = [
  "/",
  "/evidence",
  "/evidence/bills",
  "/evidence/court-cases",
  "/evidence/ssa-examples",
  "/evidence/rules",
  "/evidence/operations",
  "/evidence/impact",
  "/about",
  "/stack",
  "/learn",
  "/agents",
  "/organizations",
  "/developers",
  "/developers/docs",
  "/try",
  ...PRESETS.map((p) => `/try/presets/${p.id}`),
  "/status",
  "/g/maya",
  "/g/maya/report",
  "/g/maya/report/easy",
  "/g/maya/calendar",
  "/dashboard",
] as const;

/**
 * Paths crawlers are asked not to fetch, each with why. Gift pages other than the sample (/g/{slug}) are made for one
 * person; they carry a noindex tag instead, so a crawler that finds one reads that tag and leaves it out.
 */
export const PRIVATE_PATHS: { path: string; why: string }[] = [
  { path: "/api/", why: "the API, for programs" },
  { path: "/manage/", why: "an organizer's private manage link" },
  { path: "/m/", why: "a giver's private monthly-gift link" },
  { path: "/r/", why: "the receipt for one gift" },
  { path: "/v/", why: "the check page behind one report's QR code" },
  { path: "/developers/keys", why: "a developer's own keys and usage" },
  { path: "/ops", why: "live operations counts, read fresh on every visit" },
];

/** Pages that are neither: /app forwards to /try, and /g/{slug} is a person's own page unless it is the sample. */
export const NOT_LISTED = ["/app", "/g/[slug]"] as const;
