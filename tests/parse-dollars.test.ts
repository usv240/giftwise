import { describe, expect, it } from "vitest";
import { parseDollars, parseOptionalDollars } from "@/lib/parseDollars";
import { DEFAULT_PROFILE, evaluateGift } from "@/lib/rules";

describe("parseDollars", () => {
  it.each([
    ["1000", 1000],
    ["1,000", 1000],
    ["$1,000", 1000],
    ["$300", 300],
    [" 300 ", 300],
    ["1 000", 1000],
    ["$1,234.56", 1234.56],
    ["300.", 300],
    [".50", 0.5],
    ["300 dollars", 300],
    ["USD 75", 75],
    ["1.5k", 1500],
    ["2K", 2000],
    ["0", 0],
    ["$0.00", 0],
    ["19.999", 20],
  ])("reads %j as %d", (raw, want) => {
    expect(parseDollars(raw)).toBe(want);
  });

  it.each(["", "   ", "$", "abc", "one thousand", ",", "."])("finds no amount in %j", (raw) => {
    expect(parseDollars(raw)).toBeNull();
  });

  it("does not turn a typed thousand into a $0 gift that keeps her check", () => {
    const amount = parseDollars("1,000");
    expect(amount).toBe(1000);
    const result = evaluateGift({ id: "t", date: "2026-04-10", amount: amount!, delivery: "cash", category: "other" }, DEFAULT_PROFILE);
    expect(result.countedAmount).toBeGreaterThan(0);
    expect(result.checkAfter).toBeLessThan(result.checkBaseline);
  });
});

describe("parseOptionalDollars", () => {
  it("treats an empty field as $0", () => {
    expect(parseOptionalDollars("")).toBe(0);
    expect(parseOptionalDollars("  ")).toBe(0);
  });
  it("still reads amounts and flags text with no number", () => {
    expect(parseOptionalDollars("$1,240")).toBe(1240);
    expect(parseOptionalDollars("none")).toBeNull();
  });
});
