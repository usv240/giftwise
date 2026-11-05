import { describe, expect, it } from "vitest";
import { localSearch, ruleDocs } from "@/lib/rulebook";

describe("ask the rulebook: the in-app search over SSI's own text", () => {
  it("holds the regulations, SSA's manual, its worked examples and Giftwise's rules", () => {
    const kinds = new Set(ruleDocs().map((d) => d.kind));
    expect([...kinds].sort()).toEqual(["example", "manual", "regulation", "rule"]);
    expect(ruleDocs().length).toBeGreaterThan(100);
  });

  it("finds SSA's own text on a bill someone else pays", () => {
    const hits = localSearch("my sister pays my phone bill");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.slice(0, 3).some((h) => /phone|bills? paid/i.test(`${h.title} ${h.text}`))).toBe(true);
  });

  it("finds the ABLE account rules for an ABLE question", () => {
    expect(localSearch("can a gift go into an ABLE account").slice(0, 3).some((h) => /ABLE/.test(`${h.cite} ${h.title} ${h.text}`))).toBe(true);
  });

  it("finds nothing for words the rulebook does not hold", () => {
    expect(localSearch("zzzz qqqq")).toEqual([]);
  });
});
