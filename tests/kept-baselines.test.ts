import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sample from "../content/sample-year.json";
import { KEPT_VS_CASH, keptAgainstCash, keptSentence, monthsFor } from "@/lib/dashboard/data";
import { payItYourself, sampleYearSentence } from "@/lib/impact";
import { usd, type Category, type Delivery } from "@/lib/rules";

/**
 * Two "kept" figures measure against two baselines, and each page names its own beside the number: the dashboard keeps
 * a sum against the same gifts given as cash (src/lib/dashboard/data.ts), the home page and docs/real-world.md the sample
 * year against each giver paying the shop on their own (src/lib/impact.ts payItYourself). One source each.
 */
describe("each kept figure names its baseline", () => {
  const gifts = (sample.gifts as { date: string; amount: number; delivery: Delivery; category: Category; giver: string; recurring: boolean }[]).map((g, i) => ({ id: `s${i}`, ...g }));

  it("the dashboard's figure is against cash, summed month by month, and its sentence says so", () => {
    const months = monthsFor(gifts);
    const kept = keptAgainstCash(months);
    expect(kept).toBe(Math.round(months.reduce((s, m) => s + (m.checkWithGiftwise - m.checkIfCash), 0) * 100) / 100);
    expect(keptSentence(months, usd)).toBe(`Giftwise kept ${usd(kept)} in her checks over ${months.length} months, ${KEPT_VS_CASH}.`);
    const page = readFileSync("src/app/dashboard/page.tsx", "utf8");
    expect(page).toContain("keptSentence(months, usd)");
    expect(page).toContain("Kept in her checks, {KEPT_VS_CASH}");
  });

  it("the sample-year figure is against each giver paying on their own, on the home page and in docs/real-world.md", () => {
    const y = payItYourself();
    expect(sampleYearSentence()).toContain("with each giver paying on their own");
    const home = readFileSync("src/app/page.tsx", "utf8");
    expect(home).toContain("{cents(YEAR.totalLowered)}");
    expect(home).toContain("against {YEAR.givers} givers each paying on their own");
    expect(readFileSync("docs/real-world.md", "utf8")).toContain(sampleYearSentence());
    // Different baselines, different numbers: neither page may borrow the other's.
    expect(y.totalLowered).not.toBe(keptAgainstCash(monthsFor(gifts)));
  });
});
