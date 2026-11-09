import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import field from "../content/eval/field-cases-results.json";
import { COMPUTED_CASES, COURT_SCORE, KEPT_SENTENCE } from "@/lib/impact";

/**
 * The court cases carry one label wherever they are counted: how many of the scored cases agree, and how many cases the
 * set holds ("14 of 14 scored, of 36 cases"), and the dollar figures use the file's own word for the cases it computed
 * (summary.dollars.cases_computed), never the separate count of amounts an opinion states (summary.amounts_stated).
 */
const S = field.summary;
const DOCS = ["README.md", "TESTING.md", "docs/tests.md", "docs/evidence-index.md", "docs/results.md"];
const PAGES = ["src/app/page.tsx", "src/app/evidence/page.tsx", "src/app/evidence/rules/page.tsx", "src/app/evidence/court-cases/page.tsx", "src/components/evidence/Results.tsx", "src/components/evidence/FieldCases.tsx", "src/components/evidence/WhatIsFirst.tsx"];

describe("one label for the court cases", () => {
  it("is the file's counts", () => {
    expect(COURT_SCORE).toBe(`${S.agreed} of ${S.scored} scored, of ${S.cases} cases`);
    expect(COMPUTED_CASES).toBe(`all ${S.dollars.cases_computed} cases computed in dollars`);
    expect(KEPT_SENTENCE).toContain(COMPUTED_CASES);
  });

  it("every document line that counts the court cases says scored, of how many cases", () => {
    for (const file of DOCS) {
      for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
        if (!/court/i.test(line) || !line.includes(`${S.agreed} of ${S.scored}`)) continue;
        expect(line, file).toContain(COURT_SCORE);
      }
      expect(readFileSync(file, "utf8"), file).not.toMatch(/with stated amounts|whose amounts are stated/);
    }
  });

  it("every page that shows the score names the scored cases and the set beside it", () => {
    for (const file of PAGES) {
      const src = readFileSync(file, "utf8");
      const shows = /agreed\}? of \{?[\w.]*scored\}?/.test(src);
      if (!shows) {
        expect(src, file).toContain("COURT_SCORE");
        continue;
      }
      expect(src, file).toMatch(/scored, of (\{[\w.]*cases\}|<span className="tabular">\{[\w.]*cases\}<\/span>) cases/);
    }
  });
});
