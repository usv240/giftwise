import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import results from "../content/eval-results.json";
import { noAiOutcomes, whatAiAdds, whatAiAddsSentence } from "@/lib/review/what-ai-adds";

/**
 * A router with no AI, beside each reviewer alone and the referee, on the recorded run: no model call. The reviewer and
 * referee columns must be the run's own summary, and docs/results.md must state the table and the finding as computed.
 */
describe("what the AI adds, measured", () => {
  const t = whatAiAdds();
  const col = (id: string) => t.columns.find((c) => c.id === id)!;

  it("the router with no AI never reads a bill, so it sends every bill to the route safe under both readings", () => {
    const none = noAiOutcomes();
    expect(none).toHaveLength(results.cases.length);
    expect(new Set(none.map((o) => o.route))).toEqual(new Set(["able"]));
  });

  it("the reviewer and referee columns are the recorded run's own counts", () => {
    for (const id of ["regs", "poms", "referee"] as const) {
      expect(col(id).whole, id).toBe(results.summary[id].check_kept_whole);
      expect(col(id).wrong, id).toBe(results.summary[id].wrong_routes_accepted);
      expect(col(id).direct, id).toBeLessThanOrEqual(t.payable);
    }
    expect(t.payable).toBe(results.cases.filter((c) => c.truth === "not_shelter").length);
  });

  it("docs/results.md states the table and the finding as computed", () => {
    const doc = readFileSync("docs/results.md", "utf8");
    const row = (k: "whole" | "wrong" | "direct") => t.columns.map((c) => (k === "whole" ? `${c.whole} of ${t.bills}` : k === "wrong" ? `${c.wrong}` : `${c.direct} of ${t.payable}`)).join(" | ");
    expect(doc).toContain(`| Her check kept whole | ${row("whole")} |`);
    expect(doc).toContain(`| Wrong routes accepted | ${row("wrong")} |`);
    expect(doc).toContain(`of the ${t.payable} that are not housing | ${row("direct")} |`);
    expect(doc).toContain(whatAiAddsSentence());
  });
});
