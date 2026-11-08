import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE, FULL_CHECKS, evaluateGift, fullCheck, fullCheckByYear, type Category, type Delivery } from "@/lib/rules";
import { TOOLS } from "@/lib/mcp/tools";

/**
 * The full SSI check is $994 in 2026 and $1,029 from January 2027, so a page that names a full check without its year
 * reads as two different answers. These fail when an amount is stated with no year: in the engine's own sentences, in
 * the MCP tool's description, and in every sentence the site, the README and the docs write by hand. (The rendered
 * pages are checked the same way by tests/e2e/smoke.mjs.)
 */
const AMOUNTS = FULL_CHECKS.flatMap((r) => [r.individual, r.couple]).map((n) => `$${n.toLocaleString("en-US")}`);
const AMOUNT = new RegExp(`(${AMOUNTS.map((a) => a.replace(/[$.]/g, "\\$&")).join("|")})(?![\\d,])(?!\\.\\d)`);
const YEAR = /\b20(2[6-9])\b/;
const sentences = (text: string) => text.split(/(?<=[.!?])\s+|\n+/);
const unlabeled = (text: string) => sentences(text).filter((s) => AMOUNT.test(s) && !YEAR.test(s));

describe("every full check is named with its year", () => {
  it("one source: the amounts by year come from content/facts.json", () => {
    expect(FULL_CHECKS.map((r) => r.year)).toEqual([2026, 2027]);
    expect(fullCheckByYear()).toBe("$994 in 2026, $1,029 from January 2027");
    expect(fullCheck("2027-01").label).toBe("$1,029 (2027)");
    expect(fullCheck("2026-12").label).toBe("$994 (2026)");
  });

  it("the rules engine's sentences name the check's month and year", () => {
    const categories: Category[] = ["equipment", "medical", "education", "utility", "rent", "food", "clothing", "event", "other"];
    const deliveries: Delivery[] = ["cash", "vendor", "item", "able"];
    let checked = 0;
    for (const month of ["2026-03", "2026-10", "2026-11", "2026-12"])
      for (const category of categories)
        for (const delivery of deliveries)
          for (const amount of [50, 420, 1000]) {
            const r = evaluateGift({ id: "y", date: `${month}-10`, amount, delivery, category }, DEFAULT_PROFILE);
            expect(unlabeled(r.explanation.plain), r.explanation.plain).toEqual([]);
            expect(unlabeled(r.explanation.technical), r.explanation.technical).toEqual([]);
            checked++;
          }
    expect(checked).toBeGreaterThan(400);
  });

  it("the MCP check_gift tool says which year's amount it uses", () => {
    const d = TOOLS.find((t) => t.name === "check_gift")!.description;
    expect(d).toContain(fullCheckByYear());
    expect(d).not.toMatch(/Uses the 2026 federal SSI amount/);
  });

  it("no hand-written sentence in the site, the README or the docs names a full check without its year", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = path.join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(tsx?|md)$/.test(f)) files.push(p);
      }
    };
    walk("src");
    walk("docs");
    files.push("README.md", "TESTING.md", "content/info.json", "content/info.es.json", "content/glossary.json");
    const found: string[] = [];
    for (const f of files) {
      // Lines that are code or data, not prose: comments, and quoted JSON field values in the API examples.
      const text = readFileSync(f, "utf8")
        .split(/\r?\n/)
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join("\n");
      for (const s of unlabeled(text)) found.push(`${f}: ${s.trim().slice(0, 160)}`);
    }
    expect(found).toEqual([]);
  });
});
