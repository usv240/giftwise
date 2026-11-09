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

  it("every cited line holds the symbol or text named beside it", () => {
    // `path:N` or `path:N-M`, or `:N` for the same file again, then "(" and the anchor: a `symbol` or a "quoted text".
    // A symbol written as name() is looked for as name.
    const cited = [...doc.matchAll(/`((?:src|tests|scripts|content|docs|workflows|postman|public|\.github)\/[\w./@\[\]-]+?)?:(\d+)(?:-(\d+))?`( \((?:`([^`]+)`|"([^"]+)"))?/g)];
    expect(cited.length).toBeGreaterThanOrEqual(14);
    let path = "";
    for (const m of cited) {
      path = m[1] ?? path;
      const from = Number(m[2]);
      const to = Number(m[3] ?? m[2]);
      const anchor = (m[5] ?? m[6] ?? "").replace(/\(\)$/, "");
      expect(anchor, `${path}:${from} names what is there`).not.toBe("");
      const lines = readFileSync(path, "utf8").split("\n").slice(from - 1, to).join("\n");
      expect(lines, `${path}:${from}${to !== from ? `-${to}` : ""} holds ${anchor}`).toContain(anchor);
    }
  });

  it("the counts it states are in the files it names", () => {
    const at = (path: string) => readFileSync(path, "utf8");
    expect(at("scripts/run-field-cases.ts")).toContain("overpaymentCheck");
    expect((at("src/lib/mcp/tools.ts").match(/^\s*name: "/gm) ?? []).length).toBe(9);
  });

  it("has ten numbered rows, and the README links to it", () => {
    expect(doc.split("\n").filter((l) => /^\| \d+ \|/.test(l))).toHaveLength(10);
    expect(readme).toContain("docs/evidence-index.md");
  });
});
