import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * docs/evidence-index.md names a file and line for every claim. Each path must exist, each line number must be inside
 * its file, and the symbols the index says sit there must be in that file, so the index cannot drift from the code.
 */
const doc = readFileSync("docs/evidence-index.md", "utf8");
const readme = readFileSync("README.md", "utf8");

/** Every backticked repository path, with its line reference when it has one: "src/lib/audit.ts:17" or "tests/referee.test.ts:26-66". */
const refs = [...doc.matchAll(/`((?:src|tests|scripts|content|docs|workflows|postman|public|\.github)\/[\w./@\[\]-]+?)(?::([\d, -]+))?`/g)].map((m) => ({ path: m[1], lines: m[2] }));

describe("the claims-to-evidence index", () => {
  it("names at least twenty repository paths, and every one exists", () => {
    expect(new Set(refs.map((r) => r.path)).size).toBeGreaterThanOrEqual(20);
    for (const r of refs) expect(existsSync(r.path), r.path).toBe(true);
  });

  it("every line number is inside its file", () => {
    for (const r of refs.filter((x) => x.lines)) {
      expect(statSync(r.path).isFile(), r.path).toBe(true);
      const count = readFileSync(r.path, "utf8").split("\n").length;
      for (const n of r.lines!.split(/[,\s-]+/).filter(Boolean).map(Number)) expect(n, `${r.path}:${n}`).toBeLessThanOrEqual(count);
    }
  });

  it("the symbols it points at are in the files it names", () => {
    const at = (path: string) => readFileSync(path, "utf8");
    expect(at("src/lib/paypal/gift-order.ts").split("\n").slice(40, 56).join("\n")).toContain("payeeEmail(");
    expect(at("src/lib/paypal/capture.ts").split("\n").slice(39, 42).join("\n")).toContain("PayPal-Request-Id");
    expect(at("src/lib/error-rates.ts").split("\n")[74]).toContain("ERROR_RATES");
    const audit = at("src/lib/audit.ts").split("\n");
    expect(audit[16]).toContain("hashEvent");
    expect(audit[47]).toContain("verifyChain");
    expect(audit[62]).toContain("verifyLedger");
    const impact = at("src/lib/impact.ts").split("\n");
    expect(impact[37]).toContain("IMPACT");
    expect(impact[75]).toContain("FAMILY_SENTENCE");
    expect(impact[79]).toContain("FAMILY_BASIS");
    expect(at("tests/e2e/api.mjs").split("\n")[246]).toContain("nine tools");
    expect(at("content/eval/held-out-results.json").split("\n")[3]).toContain("commit");
    expect(at("scripts/run-field-cases.ts")).toContain("overpaymentCheck");
    expect((at("src/lib/mcp/tools.ts").match(/^\s*name: "/gm) ?? []).length).toBe(9);
  });

  it("has ten numbered rows, and the README links to it", () => {
    expect(doc.split("\n").filter((l) => /^\| \d+ \|/.test(l))).toHaveLength(10);
    expect(readme).toContain("docs/evidence-index.md");
  });
});
