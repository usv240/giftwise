import { describe, expect, it } from "vitest";
import data from "../content/eval/held-out.json";
import recorded from "../content/eval/held-out-results.json";
import second from "../content/eval/held-out-2.json";
import secondRun from "../content/eval/held-out-2-results.json";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { HELD_OUT_2_NEW_FIELDS, heldOut2AfterFix, scoreHeldOut, type HeldOutCase } from "@/lib/held-out";
import * as rules from "@/lib/rules";

/**
 * SSA's held-out worked examples were scored once on the engine frozen at recorded.engine.commit (scripts/run-held-out.ts).
 * The current engine must give the same answers, so a later change to the rules shows up here, case by case.
 */
describe("the held-out set", () => {
  const now = scoreHeldOut(data.cases as unknown as HeldOutCase[], rules);
  it("the record covers every case, with its summary", () => {
    expect(recorded.cases.map((c) => c.id)).toEqual(data.cases.map((c) => c.id));
    expect(recorded.summary.engine_matches).toBe(recorded.cases.filter((c) => c.match).length);
    expect(recorded.summary.cases).toBe(data.cases.length);
  });
  it("the current engine answers each case as the frozen one did", () => {
    for (const c of now) {
      const r = recorded.cases.find((x) => x.id === c.id)!;
      expect({ id: c.id, match: c.match, counts: c.engine_counts, got: c.values.map((v) => v.got) }).toEqual({ id: r.id, match: r.match, counts: r.engine_counts, got: r.values.map((v) => v.got) });
    }
  });
});

/**
 * The second held-out set was written and fixed before it ran (content/eval/held-out-2.json), then run once on the frozen
 * engine. The record names the file that ran by its bytes, so a later edit to the set or the expected answers shows here.
 */
describe("the second held-out set, written before it was run", () => {
  it("the file is byte for byte the one that ran", () => {
    expect(createHash("sha256").update(readFileSync("content/eval/held-out-2.json", "utf8").replace(/\r\n/g, "\n")).digest("hex")).toBe(secondRun.set.sha256);
    expect(execFileSync("git", ["hash-object", "content/eval/held-out-2.json"], { encoding: "utf8" }).trim()).toBe(secondRun.set.git_blob);
  });
  it("the record covers every case and stays the frozen run: 1 of 5 at c5e94eb", () => {
    expect(secondRun.cases.map((c) => c.id)).toEqual(second.cases.map((c) => c.id));
    expect(secondRun.summary.engine_matches).toBe(secondRun.cases.filter((c) => c.match).length);
    expect({ commit: secondRun.engine.commit, matches: secondRun.summary.engine_matches, cases: secondRun.summary.cases }).toEqual({ commit: "c5e94eb", matches: 1, cases: 5 });
  });
});

/**
 * After the fix, not a held-out result: R-SHEL-03, R-SHEL-04 and R-SHEL-05 were written after seeing the second set.
 * The current engine is scored on the five as written, and with the fact two cases needed a new field for, quoted from
 * each case's own situation. The evidence page and docs/results.md state these figures (tests/docs-numbers.test.ts).
 */
describe("the second set after the three housing rules were added", () => {
  const cases = second.cases as unknown as HeldOutCase[];
  const after = heldOut2AfterFix(cases, rules);
  const frozen = new Map(secondRun.cases.map((c) => [c.id, c]));
  it("each new field's fact is in that case's own situation, and the values match it", () => {
    for (const [id, f] of Object.entries(HELD_OUT_2_NEW_FIELDS)) {
      const c = second.cases.find((x) => x.id === id)!;
      expect(c.situation).toContain(f.fact);
    }
    expect(HELD_OUT_2_NEW_FIELDS["rent-below-market-from-child"].fact).toContain(`$${HELD_OUT_2_NEW_FIELDS["rent-below-market-from-child"].fields.rentPaid}`);
  });
  it("as written, the two home gifts now match and the mobile home still does; the other two need their new field", () => {
    expect(after.asWritten).toEqual({ matches: 3, cases: 5, misses: ["co-owner-mortgage", "rent-below-market-from-child"] });
    expect(after.asWritten.misses).toEqual(after.newFields);
    for (const c of scoreHeldOut(cases, rules)) if (!after.newFields.includes(c.id)) expect(c.match, c.id).toBe(true);
    // The frozen run counted nothing for either home given as itself; the current engine counts the presumed maximum value.
    expect(frozen.get("house-deeded-by-parents")!.values.map((v) => v.got)).toEqual([0, 0]);
    expect(frozen.get("home-from-son")!.values.map((v) => v.got)).toEqual([0]);
  });
  it("with the new fields, every case gives SSA's answer", () => {
    expect(after.withFields).toEqual({ matches: 5, cases: 5, misses: [] });
    const got = (id: string) => after.cases.find((c) => c.id === id)!.values.map((v) => v.got);
    expect(got("co-owner-mortgage")).toEqual([200, 200, 200]);
    expect(got("house-deeded-by-parents")).toEqual([351.33, 0]);
    expect(got("home-from-son")).toEqual([351.33]);
    expect(got("rent-below-market-from-child")).toEqual([71.33]);
  });
});
