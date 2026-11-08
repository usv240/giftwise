import { describe, expect, it } from "vitest";
import { CHECKER_PROFILE, checkerGift } from "@/lib/checker";
import { DEFAULT_PROFILE, evaluateGift, type Profile } from "@/lib/rules";

/**
 * The home page's Gift Checker and Maya's gift page name the same check: the same date (today, on the server), the
 * same profile and the same engine. Each date below is a gift made that day.
 */
describe("the Gift Checker and Maya's page agree", () => {
  it("on the month and the check, for a gift made on any day", async () => {
    // households.ts reads the database lazily; importing it for SAMPLE and cashExample opens no connection.
    const { CASH_EXAMPLE_USD, SAMPLE, cashExample } = await import("@/lib/households");
    const maya: Profile = { ...DEFAULT_PROFILE, ...(SAMPLE.profile as Partial<Profile>) };
    for (const date of ["2026-04-10", "2026-10-28", "2026-11-08", "2026-12-31", "2027-01-15"]) {
      const page = cashExample(maya, date);
      const shop = evaluateGift(checkerGift("shop", 1000, date), CHECKER_PROFILE);
      const cash = evaluateGift(checkerGift("cash", CASH_EXAMPLE_USD, date), CHECKER_PROFILE);
      expect(shop.paymentMonth, date).toBe(page.paymentMonth);
      expect(shop.checkAfter, date).toBe(page.checkBaseline);
      // Her page's cash example and the checker's cash answer are one engine answer too.
      expect(cash.checkAfter, date).toBe(page.checkAfter);
    }
  });
  it("names January's 2027 check for a gift made in November", () => {
    const r = evaluateGift(checkerGift("shop", 1000, "2026-11-08"), CHECKER_PROFILE);
    expect(r.paymentMonth).toBe("2027-01");
    expect(r.checkAfter).toBe(1029);
  });
});
