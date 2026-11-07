/**
 * The rules watch: ask the Federal Register, live, for every document that changes how SSI counts income or in-kind
 * support (20 CFR Part 416) and every SSA notice of the year's SSI amounts, then compare the list with the documents
 * Giftwise has already reviewed (content/rules-watch.json). Any document not on that list is named, so a change in the
 * rules shows up the day it is published. The Federal Register API needs no key.
 */
import watch from "../../content/rules-watch.json";
import { RATE_YEARS } from "./rules";

const API = "https://www.federalregister.gov/api/v1/documents.json";
const FIELDS = ["document_number", "citation", "publication_date", "title", "type", "html_url"];

/** The three questions asked: final and proposed rules that mention ISM or unearned income, and the yearly amounts notices. */
export const QUERIES = [
  { kind: "rules", label: "Final and proposed rules for 20 CFR Part 416 that mention in-kind support and maintenance", params: { "conditions[cfr][title]": "20", "conditions[cfr][part]": "416", "conditions[type][]": ["RULE", "PRORULE"], "conditions[term]": '"in-kind support and maintenance"', "conditions[publication_date][gte]": "2022-01-01" } },
  { kind: "rules", label: "Final and proposed rules for 20 CFR Part 416 that mention unearned income", params: { "conditions[cfr][title]": "20", "conditions[cfr][part]": "416", "conditions[type][]": ["RULE", "PRORULE"], "conditions[term]": '"unearned income"', "conditions[publication_date][gte]": "2022-01-01" } },
  { kind: "amounts", label: "SSA notices of the year's cost-of-living increase and SSI amounts", params: { "conditions[agencies][]": ["social-security-administration"], "conditions[type][]": ["NOTICE"], "conditions[term]": '"Cost-of-Living Increase and Other Determinations"', "conditions[publication_date][gte]": "2024-01-01" } },
] as const;

export type WatchDoc = { number: string; citation: string; published: string; title: string; url: string; reviewed: boolean; how?: string };
export type Watch = {
  status: "current" | "new_documents" | "unreachable";
  checkedAt: string;
  live: boolean;
  documents: WatchDoc[];
  newest: WatchDoc | null;
  rateYears: number[];
  reviewedOn: string;
  sentence: string;
};

const REVIEWED = new Map(watch.documents.map((d) => [d.number, d]));

function url(params: Record<string, string | readonly string[]>) {
  const q = new URLSearchParams({ order: "newest", per_page: "50" });
  for (const [k, v] of Object.entries(params)) for (const x of Array.isArray(v) ? v : [v as string]) q.append(k, x);
  for (const f of FIELDS) q.append("fields[]", f);
  return `${API}?${q}`;
}

function describe(docs: WatchDoc[], live: boolean): Pick<Watch, "status" | "sentence"> {
  const fresh = docs.filter((d) => !d.reviewed);
  const rules = docs.filter((d) => REVIEWED.get(d.number)?.kind !== "amounts").length;
  const notices = docs.length - rules;
  if (fresh.length) return { status: "new_documents", sentence: `${fresh.length} new: ${fresh.map((d) => `${d.citation} (${d.published}), ${d.title}`).join("; ")}. Giftwise reviews each before it changes a rule.` };
  const years = RATE_YEARS.join(" and ");
  return {
    status: "current",
    sentence: `${live ? "Checked with the Federal Register just now" : `Last checked with the Federal Register on ${watch.reviewed_on}`}: all ${rules} SSI income rules since 2022 and all ${notices} amounts notices since 2024 are reflected. Amounts in use: ${years}.`,
  };
}

/** The reviewed list as of its date, with no call: what a page shows before the live answer arrives. */
export function reviewedWatch(status: Watch["status"] = "current", checkedAt = `${watch.reviewed_on}T12:00:00Z`): Watch {
  const documents: WatchDoc[] = watch.documents.map((d) => ({ number: d.number, citation: d.citation, published: d.published, title: d.title, url: `https://www.federalregister.gov/d/${d.number}`, reviewed: true, how: d.how }));
  return { ...describe(documents, false), status, checkedAt, live: false, documents, newest: documents[0] ?? null, rateYears: RATE_YEARS, reviewedOn: watch.reviewed_on };
}

let cache: { at: number; value: Watch } | null = null;

/** Live when the Federal Register answers; otherwise the reviewed list as of its date. Cached for six hours. */
export async function rulesWatch(timeoutMs = 8000): Promise<Watch> {
  if (cache && Date.now() - cache.at < 6 * 3600_000) return cache.value;
  const checkedAt = new Date().toISOString();
  try {
    const pages = await Promise.all(
      QUERIES.map(async (q) => {
        const r = await fetch(url(q.params), { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
        if (!r.ok) throw new Error(`Federal Register HTTP ${r.status}`);
        const j = (await r.json()) as { results?: { document_number: string; citation: string; publication_date: string; title: string; html_url: string }[] };
        return j.results ?? [];
      }),
    );
    const seen = new Map<string, WatchDoc>();
    for (const r of pages.flat()) {
      const known = REVIEWED.get(r.document_number);
      seen.set(r.document_number, { number: r.document_number, citation: r.citation, published: r.publication_date, title: r.title, url: r.html_url, reviewed: Boolean(known), how: known?.how });
    }
    const documents = [...seen.values()].sort((a, b) => b.published.localeCompare(a.published));
    const value: Watch = { ...describe(documents, true), checkedAt, live: true, documents, newest: documents[0] ?? null, rateYears: RATE_YEARS, reviewedOn: watch.reviewed_on };
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return reviewedWatch("unreachable", checkedAt);
  }
}
