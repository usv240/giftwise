import { describe, expect, it } from "vitest";
import data from "../content/eval/held-out.json";
import recorded from "../content/eval/held-out-results.json";
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
