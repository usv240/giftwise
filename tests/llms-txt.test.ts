import { describe, expect, it } from "vitest";
import { TOOLS, toolSummary } from "@/lib/mcp/tools";

/** /llms.txt lists each MCP tool by the first sentence of its description, so that sentence must say what the tool does. */
describe("the tool lines in /llms.txt", () => {
  it("say what get_ssa_report does, not the reporting rule", () => {
    const report = TOOLS.find((t) => t.name === "get_ssa_report")!;
    expect(toolSummary(report)).toMatch(/^Writes one month's report to Social Security for a Giftwise gift page/);
    expect(toolSummary(report)).not.toMatch(/must tell|within 10 days/);
  });

  it("every tool's line is one sentence of its own description", () => {
    for (const t of TOOLS) {
      const line = toolSummary(t);
      expect(t.description.startsWith(line.replace(/\.$/, "")), t.name).toBe(true);
      expect(line.length, t.name).toBeGreaterThan(20);
    }
  });
});
