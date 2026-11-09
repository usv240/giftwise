import { describe, expect, it, vi } from "vitest";
import { today } from "@/lib/api/envelope";
import { routeGift } from "@/lib/routing";
import { DEFAULT_PROFILE, P } from "@/lib/rules";

/**
 * A fund's grant is routed the way a gift to the same page is: against ABLE's yearly limit, counting what the page's
 * givers and funds already put in this year (pageProfile in src/lib/households.ts). Here the household is $150 short of
 * the limit before the fund's earlier ABLE grant, so a new grant can put only what is left into ABLE.
 */
const year = new Date().getUTCFullYear();
const household = {
  id: 7,
  slug: "near-limit",
  name: "Lee",
  status: "open",
  profile: { ...DEFAULT_PROFILE, ableEligible: true, ableContributedThisYear: P.ableAnnualLimit - 150 },
};
const needs = [
  { id: 71, householdId: 7, title: "Electric bill", detail: "", category: "utility", route: "able", payeeName: "Lee's ABLE account", payeeAccount: "able", amount: "138.00", recurring: true, link: null, status: "open", funded: "0", sortOrder: 0, archivedAt: null, createdAt: new Date() },
];
const payments = [{ route: "able", amount: "40.00", capturedAt: new Date(Date.UTC(year, 0, 15)) }];
const payouts = [{ route: "able", amount: "60.00", status: "SUCCESS", createdAt: new Date(Date.UTC(year, 1, 1)) }];

vi.mock("@/lib/households", async (orig) => {
  const real = await orig<typeof import("@/lib/households")>();
  return {
    ...real,
    getHousehold: vi.fn(async () => ({ household, needs, payments, payouts })),
    payeeEmail: (account: string) => `${account.replace(":", "-")}@business.example.com`,
  };
});

describe("a fund's grant and ABLE's yearly limit", () => {
  it("is routed as a gift to the same page is: this year's gifts and grants count, so ABLE gets only the room left", async () => {
    const { planGrants } = await import("@/lib/paypal/payouts");
    const { openNeeds, pageProfile } = await import("@/lib/households");
    const planned = await planGrants([{ slug: "near-limit", amount: 120 }]);
    expect("error" in planned).toBe(false);
    if ("error" in planned) return;
    // What the gift button, the MCP tools and the monthly planner route for the same page and amount.
    const asGift = routeGift(120, openNeeds(needs as never), today(), pageProfile({ household, payments, payouts }), "Lee's ABLE account");
    expect(planned.items.map((i) => [i.route, i.amount])).toEqual(asGift.lines.map((l) => [l.route, l.amount]));
    // $150 of room, less $40 given and $60 granted earlier this year: $50 can go to ABLE, never more.
    const toAble = planned.items.filter((i) => i.route === "able").reduce((s, i) => s + i.amount, 0);
    expect(toAble).toBe(50);
    expect(planned.households[0].unplaced).toBe(70);
    // Counting only the page's payments, as grants did before, would have put $110 into ABLE and crossed the limit.
    const paymentsOnly = routeGift(120, openNeeds(needs as never), today(), pageProfile({ household, payments }), "Lee's ABLE account");
    expect(paymentsOnly.lines.filter((l) => l.route === "able").reduce((s, l) => s + l.amount, 0)).toBe(110);
  });
});
