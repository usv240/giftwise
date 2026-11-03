import { describe, expect, it } from "vitest";
import { stressTest } from "../src/lib/review/stress";

describe("when one reviewer is wrong", () => {
  it("trusting it alone lowers her check on some bills; with the second reviewer and the referee, never", () => {
    const t = stressTest();
    expect(t.bills).toBe(20);
    expect(t.aloneWhole).toBeLessThan(t.bills);
    expect(t.refereeRealQuoteWhole).toBe(t.bills);
    expect(t.refereeInventedQuoteWhole).toBe(t.bills);
  });
});
