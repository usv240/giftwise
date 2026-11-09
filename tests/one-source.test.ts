import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import results from "../content/test-results.json";
import info from "../content/info.json";
import invariantRun from "../content/eval/invariants-results.json";
import first from "../content/eval/held-out-results.json";
import second from "../content/eval/held-out-2-results.json";
import third from "../content/eval/held-out-3-results.json";
import fourth from "../content/eval/held-out-4-results.json";
import { POST as checkGift } from "@/app/api/v1/check-gift/route";
import { checkGiftDataSchema, openapi } from "@/lib/api/openapi";
import { HELD_OUT_SCORES, HELD_OUT_SENTENCE, HELD_OUT_SETS, HELD_OUT_TOTAL } from "@/lib/held-out-summary";
import { TOOLS, toolSummary } from "@/lib/mcp/tools";
import { DEFAULT_PROFILE, evaluateGift, usd } from "@/lib/rules";
import { COUNT_WORDS, INVARIANT_RUN, suiteRows } from "@/lib/test-results";
import { incomeDay } from "@/lib/time";

/** Every file under a folder, for scanning the pages and components that state a number. */
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? files(path.join(dir, f)) : [path.join(dir, f)]));
const readme = readFileSync("README.md", "utf8");

describe("the promise count and the invariant run's date come from its results file", () => {
  it("the test results row for the invariant run is the run in content/eval/invariants-results.json", () => {
    const row = suiteRows().find((s) => s.id === "invariants")!;
    expect(row.total).toBe(invariantRun.gifts);
    expect(row.passed).toBe(INVARIANT_RUN.keptAll);
    expect(row.ranAt).toBe(incomeDay(invariantRun.ran_at));
    expect(row.what).toContain(`each held to ${INVARIANT_RUN.promisesWord} promises`);
    expect(INVARIANT_RUN.promises).toBe(invariantRun.results.length);
  });

  it("no row, Info entry or document states another number of promises", () => {
    const texts = [
      ...suiteRows().map((s) => s.what),
      ...Object.values(info as Record<string, { what?: string; why?: string; technical?: string }>).flatMap((e) => [e.what ?? "", e.why ?? "", e.technical ?? ""]),
      readme,
      readFileSync("TESTING.md", "utf8"),
      ...["docs/results.md", "docs/tests.md", "docs/evidence-index.md", "docs/inside.md"].map((f) => readFileSync(f, "utf8")),
    ];
    const said = texts.flatMap((t) => [...t.matchAll(new RegExp(`\\b(${COUNT_WORDS.join("|")}|\\d+) promises\\b`, "g"))].map((m) => m[1]));
    expect(said.length).toBeGreaterThan(3);
    for (const w of said) expect(w).toBe(INVARIANT_RUN.promisesWord);
    for (const s of results.suites) expect(s.what).not.toMatch(/\b(twelve|thirteen|fourteen) promises/);
  });
});

describe("the held-out summary has one source", () => {
  it("lists every set's score from its results file", () => {
    expect(HELD_OUT_SETS.map((s) => [s.matches, s.cases])).toEqual([first, second, third, fourth].map((r) => [r.summary.engine_matches, r.summary.cases]));
    expect(HELD_OUT_SCORES).toBe([first, second, third, fourth].map((r) => `${r.summary.engine_matches} of ${r.summary.cases}`).join(", ").replace(/, ([^,]*)$/, " and $1"));
    expect(HELD_OUT_TOTAL.counts).toBe(first.summary.counts_matches + second.summary.counts_matches + third.summary.counts_matches + fourth.summary.counts_matches);
    expect(HELD_OUT_SENTENCE).toContain(HELD_OUT_SCORES);
  });

  it("the /evidence card, the headline and the README state every set", () => {
    expect(readme).toContain(HELD_OUT_SCORES);
    // Only the held-out section itself reads the result files; every other page and component takes the summary.
    const readers = [...files("src/app"), ...files("src/components")].filter((f) => /\.tsx?$/.test(f) && /held-out(-\d)?-results\.json/.test(readFileSync(f, "utf8")));
    expect(readers.map((f) => f.replace(/\\/g, "/"))).toEqual(["src/components/evidence/HeldOut.tsx"]);
    for (const f of ["src/app/evidence/page.tsx", "src/components/evidence/Impact.tsx", "src/components/evidence/Results.tsx", "src/components/evidence/WhatIsFirst.tsx"]) expect(readFileSync(f, "utf8"), f).toContain("@/lib/held-out-summary");
  });
});

describe("the ABLE share reads the same everywhere an agent looks", () => {
  it("the checkout and report tools say what README's first line says", () => {
    for (const name of ["start_gift_checkout", "get_ssa_report"]) {
      const d = TOOLS.find((t) => t.name === name)!.description;
      expect(d, name).toContain("ABLE plan's own gift page");
      expect(d, name).not.toMatch(/\(the shops and the ABLE account\)|straight to a shop or the ABLE account/);
    }
    expect(readme.split("\n")[2]).toContain("the share for the person's ABLE account goes through the ABLE plan's own gift page");
    // /llms.txt is its opening line plus each tool's first sentence (toolSummary), read from its route.
    const route = readFileSync("src/app/llms.txt/route.ts", "utf8");
    expect(route).toContain("goes through the ABLE plan's own gift page");
    expect(route).toContain("toolSummary(t)");
    expect(toolSummary(TOOLS.find((t) => t.name === "start_gift_checkout")!)).toContain("ABLE plan's own gift page");
  });
});

describe("check-gift names each resource test for the day it is for", () => {
  const post = (body: unknown) => new Request("http://localhost/api/v1/check-gift", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.91" }, body: JSON.stringify(body) });

  it("README's $1,000 in cash: the check drops two months later, and the same call flags savings on the 1st of the next month", async () => {
    const res = await checkGift(post({ gift: { amount: 1000, delivery: "cash", category: "other", date: "2026-11-10" } }));
    const d = (await res.json()).data;
    expect(d.resources_after_gift).toMatchObject({ on: "2026-12-01", over: true, countable: DEFAULT_PROFILE.savings + 1000 });
    expect(d.resources_for_check).toMatchObject({ on: "2027-01-01", over: false, status: "under" });
    // Version 1's fields stay, each the same value as the field that names its day.
    expect(d.savings_on_next_first).toBe(d.resources_after_gift.countable);
    expect(d.over_savings_limit).toBe(d.resources_after_gift.over);
    expect(d.able_balance_on_next_first).toBe(d.resources_after_gift.able_balance);
    expect(d.resource_status).toBe(d.resources_for_check.status);
    const r = evaluateGift({ id: "p", date: "2026-11-10", amount: 1000, delivery: "cash", category: "other" }, DEFAULT_PROFILE);
    expect(readme).toContain(`takes her savings to ${usd(r.resourcesAfter.countable)} on December 1, over the ${usd(r.resourcesAfter.limit)} limit`);
    expect(readme).toContain("`resources_after_gift`");
  });

  it("the OpenAPI document describes both tests and marks the old fields deprecated", () => {
    const spec = openapi("") as unknown as { paths: Record<string, Record<string, { responses: Record<string, { content: Record<string, { schema: { allOf?: { properties?: { data?: { $ref: string } } }[] } }> }> }>>; components: { schemas: Record<string, unknown> } };
    const ok = spec.paths["/api/v1/check-gift"].post.responses["200"].content["application/json"].schema;
    expect(ok.allOf?.[1].properties?.data?.$ref).toBe("#/components/schemas/CheckGiftData");
    const data = checkGiftDataSchema() as { properties: Record<string, { deprecated?: boolean; description?: string }> };
    expect(spec.components.schemas.CheckGiftData).toEqual(data);
    for (const k of ["resources_after_gift", "resources_for_check"]) expect(data.properties[k].deprecated, k).toBeUndefined();
    for (const k of ["savings_on_next_first", "over_savings_limit", "able_balance_on_next_first", "resource_status"]) {
      expect(data.properties[k].deprecated, k).toBe(true);
      expect(data.properties[k].description, k).toMatch(/^Deprecated, kept for version 1: resources_(after_gift|for_check)\./);
    }
  });
});

describe("one start path", () => {
  it("the home hero's first secondary action and the README's start line both open the five-minute path", () => {
    const home = readFileSync("src/app/page.tsx", "utf8");
    const actions = home.slice(home.indexOf('className="hero-actions"'), home.indexOf('className="hero-note'));
    const links = [...actions.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(links.slice(0, 2)).toEqual(["/start", "/evidence#path"]);
    expect(actions).toContain("See it work in five minutes");
    expect(readme).toContain("- **Start here:** [the five-minute path](https://giftwise-405i.onrender.com/evidence#path), the home page's **See it work in five minutes**.");
    // The path's first step is the home page's Gift Checker, as the README says.
    expect(readFileSync("src/app/evidence/page.tsx", "utf8")).toMatch(/const PATH = \[\s*\{ href: "\/", label: "The problem in one number"/);
  });
});

describe("the home page opens short, nothing removed", () => {
  it("keeps the Gift Checker, how it works and one proof line on load, and folds every other part under its heading", () => {
    const home = readFileSync("src/app/page.tsx", "utf8");
    const fold = home.indexOf('<div className="frame home-folds"');
    const onLoad = home.slice(0, fold);
    for (const part of ["<GiftChecker />", 'id="how"', 'className="frame home-proof"']) expect(onLoad, part).toContain(part);
    const folded = home.slice(fold);
    for (const part of ["<ShowcaseBoard />", "<RefereeMoment />", "<WhatIsNew", "<Faq", "<CtaDialog />", "HOUSING_HARM", 'className="intro-statement"']) expect(folded, part).toContain(part);
    expect((folded.match(/<HomeFold\b/g) ?? []).length).toBe(6);
  });
});
