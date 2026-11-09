import { describe, expect, it } from "vitest";
import { CheckGiftRequest, PlanMonthRequest } from "@/lib/api/schemas";
import { TOOLS } from "@/lib/mcp/tools";
import { CHECKER_PROFILE } from "@/lib/checker";
import { evaluateGift, planMonths } from "@/lib/rules";

/**
 * The three housing rules (R-SHEL-03, R-SHEL-04, R-SHEL-05) reach every surface that takes a gift from outside the app:
 * the API's request schemas, the MCP check_gift tool, and the engine call the Gift Checker on /try makes. The running
 * server's answers are checked by tests/e2e/api.mjs (check-gift, plan-month, MCP check_gift and plan_gift) and
 * tests/e2e/ui.mjs (/try); the router and the bill route by tests/routing.test.ts.
 */
const home = { amount: 40000, delivery: "item", category: "mortgage", date: "2026-06-15" } as const;

describe("a home given as itself, and the other two housing rules, on each surface", () => {
  it("the API takes the new fields and refuses months that run backwards", () => {
    expect(CheckGiftRequest.safeParse({ gift: home }).success).toBe(true);
    const coOwner = CheckGiftRequest.safeParse({ gift: { amount: 1600, delivery: "vendor", category: "mortgage", covers: { from: "2025-08", to: "2026-03" }, payerCoOwns: true } });
    expect(coOwner.success && coOwner.data.gift.payerCoOwns).toBe(true);
    expect(CheckGiftRequest.safeParse({ gift: { amount: 130, delivery: "vendor", category: "rent", rentPaid: 280 } }).success).toBe(true);
    expect(CheckGiftRequest.safeParse({ gift: { amount: 100, delivery: "vendor", category: "rent", covers: { from: "2026-05", to: "2026-03" } } }).success).toBe(false);
    expect(PlanMonthRequest.safeParse({ gifts: [{ ...home, covers: { from: "2026-13", to: "2026-14" } }] }).success).toBe(false);
  });

  it("MCP check_gift counts a home given as itself at the presumed maximum value", async () => {
    const tool = TOOLS.find((t) => t.name === "check_gift")!;
    const out = await tool.run(tool.input.parse(home) as never, { origin: "http://localhost" });
    expect(out.data?.check_after).toBe(662.67);
    expect(out.data?.rule_ids).toEqual(["R-SHEL-03", "R-GIE-01"]);
    expect(out.text).toMatch(/^A home given outright counts as housing support/);
  });

  it("MCP check_gift takes a co-owner's payment and the rent paid below market", async () => {
    const tool = TOOLS.find((t) => t.name === "check_gift")!;
    const run = (args: Record<string, unknown>) => tool.run(tool.input.parse(args) as never, { origin: "http://localhost" });
    const coOwner = await run({ amount: 1600, delivery: "vendor", category: "mortgage", date: "2026-02-28", covers: { from: "2025-08", to: "2026-03" }, payer_co_owns: true });
    expect(coOwner.data?.check_after).toBe(814);
    expect(coOwner.data?.rule_ids).toContain("R-SHEL-04");
    const subsidy = await run({ amount: 130, delivery: "vendor", category: "rent", recurring: true, rent_paid: 280, date: "2026-10-01" });
    expect(subsidy.data?.check_after).toBe(942.67);
    expect(subsidy.data?.rule_ids).toContain("R-SHEL-05");
  });

  it("the Gift Checker on /try (Give the item, Mortgage) and its month view count the home in June only", () => {
    const r = evaluateGift({ id: "try", ...home, label: "Your gift" }, CHECKER_PROFILE);
    expect(r.checkAfter).toBe(662.67);
    expect(r.checkAfter).toBeLessThan(r.checkBaseline);
    const plan = planMonths([{ id: "row", ...home, giver: "parents" }], CHECKER_PROFILE);
    expect(plan.months.map((m) => [m.month, m.ismValue])).toEqual([["2026-06", 351.33]]);
  });
});
