import { describe, expect, it } from "vitest";
import data from "../content/eval/held-out.json";
import recorded from "../content/eval/held-out-results.json";
import second from "../content/eval/held-out-2.json";
import secondRun from "../content/eval/held-out-2-results.json";
import third from "../content/eval/held-out-3.json";
import thirdRun from "../content/eval/held-out-3-results.json";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HeldOut } from "@/components/evidence/HeldOut";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { HELD_OUT_2_NEW_FIELDS, HELD_OUT_3_NEW_FIELDS, heldOut2AfterFix, heldOut3AfterFix, scoreHeldOut, type HeldOutCase } from "@/lib/held-out";
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

/**
 * The third set (content/eval/held-out-3.json), written and committed before it ran once on the engine frozen at
 * 7e24ed8. The record stays the frozen run; the current engine after R-SHEL-06, R-SHEL-07 and R-ABLE-03 is scored apart
 * and labelled as not a held-out result, on /evidence/ssa-examples#held-out-3 and in docs/results.md.
 */
describe("the third held-out set, written before it was run", () => {
  const cases = third.cases as unknown as HeldOutCase[];
  const after = heldOut3AfterFix(cases, rules);
  it("the file is byte for byte the one that ran", () => {
    expect(createHash("sha256").update(readFileSync("content/eval/held-out-3.json", "utf8").replace(/\r\n/g, "\n")).digest("hex")).toBe(thirdRun.set.sha256);
    expect(execFileSync("git", ["hash-object", "content/eval/held-out-3.json"], { encoding: "utf8" }).trim()).toBe(thirdRun.set.git_blob);
  });
  it("the record covers every case and stays the frozen run: 1 of 5 on every value and 5 of 5 on whether it counts, at 7e24ed8", () => {
    expect(thirdRun.cases.map((c) => c.id)).toEqual(third.cases.map((c) => c.id));
    expect(thirdRun.summary.engine_matches).toBe(thirdRun.cases.filter((c) => c.match).length);
    expect(thirdRun.summary.counts_matches).toBe(thirdRun.cases.filter((c) => c.counts_match).length);
    expect({ commit: thirdRun.engine.commit, matches: thirdRun.summary.engine_matches, counts: thirdRun.summary.counts_matches, cases: thirdRun.summary.cases }).toEqual({ commit: "7e24ed8", matches: 1, counts: 5, cases: 5 });
  });
  it("each new field's fact is in that case's own situation", () => {
    for (const [id, f] of Object.entries(HELD_OUT_3_NEW_FIELDS)) expect(third.cases.find((x) => x.id === id)!.situation).toContain(f.fact);
  });
  it("as written, the two ABLE examples now match; the weekly rent and the shared tax bill need their new field", () => {
    expect(after.asWritten).toEqual({ matches: 3, cases: 5, misses: ["weekly-rent-from-sibling", "property-tax-partly-past-with-roommate"] });
    expect(after.asWritten.misses).toEqual(after.newFields);
    const now = new Map(scoreHeldOut(cases, rules).map((c) => [c.id, c]));
    // The frozen run paid Paul and Christine the full $994; the current engine pays no SSI in a month over the limit.
    expect(thirdRun.cases.filter((c) => c.id.startsWith("able-")).map((c) => c.values[0].got)).toEqual([994, 994]);
    expect(["able-over-limit-suspends", "able-over-limit-other-resources"].map((id) => now.get(id)!.values[0].got)).toEqual([0, 0]);
  });
  it("with the new fields, every case gives SSA's answer", () => {
    expect(after.withFields).toEqual({ matches: 5, cases: 5, misses: [] });
    const got = (id: string) => after.cases.find((c) => c.id === id)!.values.map((v) => v.got);
    expect(got("weekly-rent-from-sibling")).toEqual([108.33]);
    expect(got("property-tax-partly-past-with-roommate")).toEqual([351.33, 50, 50]);
  });
  it("/evidence/ssa-examples shows the frozen run and the after-fix line from these files", () => {
    const html = renderToStaticMarkup(createElement(HeldOut)).replace(/<[^>]+>/g, "").replace(/&rsquo;/g, "’").replace(/&#x27;|&#39;/g, "'");
    const s = thirdRun.summary;
    expect(html).toContain(`then run once on the engine frozen at commit ${thirdRun.engine.commit}`);
    expect(html).toContain(`${s.engine_matches} of ${s.cases} match on every value, and ${s.counts_matches} of ${s.cases} agree with SSA on whether the gift counts`);
    expect(html).toContain(`After the fix, not a held-out result: these rules were written after seeing the five`);
    expect(html).toContain(`On the same five as written, ${after.asWritten.matches} of ${after.asWritten.cases} match.`);
    expect(html).toContain(`${after.withFields.matches} of ${after.withFields.cases} match. The frozen run’s record is unchanged.`);
    expect(html).toContain(thirdRun.set.git_blob.slice(0, 10));
  });
});
