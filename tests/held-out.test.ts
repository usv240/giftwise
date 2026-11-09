import { describe, expect, it } from "vitest";
import data from "../content/eval/held-out.json";
import recorded from "../content/eval/held-out-results.json";
import second from "../content/eval/held-out-2.json";
import secondRun from "../content/eval/held-out-2-results.json";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { scoreHeldOut, type HeldOutCase } from "@/lib/held-out";
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
  it("the record covers every case, and the current engine answers each as the frozen one did", () => {
    expect(secondRun.cases.map((c) => c.id)).toEqual(second.cases.map((c) => c.id));
    expect(secondRun.summary.engine_matches).toBe(secondRun.cases.filter((c) => c.match).length);
    for (const c of scoreHeldOut(second.cases as unknown as HeldOutCase[], rules)) {
      const r = secondRun.cases.find((x) => x.id === c.id)!;
      expect({ id: c.id, match: c.match, got: c.values.map((v) => v.got) }).toEqual({ id: r.id, match: r.match, got: r.values.map((v) => v.got) });
    }
  });
});
