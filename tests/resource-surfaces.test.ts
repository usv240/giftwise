import { describe, expect, it, vi } from "vitest";
import { CheckGiftRequest, PlanMonthRequest } from "@/lib/api/schemas";
import { POST as checkGift } from "@/app/api/v1/check-gift/route";
import { POST as planMonth } from "@/app/api/v1/plan-month/route";
import { TOOLS } from "@/lib/mcp/tools";
import { SAMPLE, pageProfile } from "@/lib/households";
import { ruleSentenceEs } from "@/lib/i18n/gift-rules";
import { routeGift, type OpenNeed } from "@/lib/routing";
import { evaluateGift, type Category, type Delivery } from "@/lib/rules";

/**
 * The rules the third held-out set showed (R-SHEL-06, R-SHEL-07, R-ABLE-03 with R-RES-01) on every surface that takes a
 * gift: an ABLE route that would take the account past $100,000 is shown with what that does, and routed elsewhere when
 * it would stop the check. The running server's answers are checked by tests/e2e/api.mjs.
 */

// plan_gift reads a gift page from the database; here the page is Maya's sample with an ABLE balance near $100,000.
const page = vi.hoisted(() => ({ ableBalance: 0 }));
vi.mock("@/lib/households", async (orig) => {
  const real = await orig<typeof import("@/lib/households")>();
  const row = (n: (typeof real.SAMPLE.needs)[number], i: number) => ({ ...n, id: i + 1, householdId: 1, sortOrder: i, status: "open", funded: "0", link: null, archivedAt: null });
  return {
    ...real,
    getHousehold: async (slug: string) =>
      slug === "maya"
        ? { household: { id: 1, slug: "maya", name: "Maya", isSample: true, profile: { ...real.SAMPLE.profile, ableBalance: page.ableBalance } }, needs: real.SAMPLE.needs.map(row), payments: [], payouts: [] }
        : null,
  };
});

const run = (name: string, args: Record<string, unknown>) => {
  const tool = TOOLS.find((t) => t.name === name)!;
  return tool.run(tool.input.parse(args) as never, { origin: "http://localhost" });
};
const post = (path: string, body: unknown) => new Request(`http://localhost${path}`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.77" }, body: JSON.stringify(body) });

/** Maya's electric bill, the need the sample sends to her ABLE account, as /g/maya evaluates it for its card. */
const electric = SAMPLE.needs.find((n) => n.route === "able")!;
const needCard = (ableBalance: number, date = "2026-11-10") => {
  const profile = pageProfile({ household: { profile: { ...SAMPLE.profile, ableBalance } }, payments: [] });
  const r = evaluateGift({ id: "n3", date, amount: Number(electric.amount), delivery: electric.route as Delivery, category: electric.category as Category, recurring: electric.recurring }, profile);
  return { r, es: ruleSentenceEs(r, profile.couple) };
};

describe("an ABLE gift that would take the account past $100,000", () => {
  it("/g/maya's electric bill card: within the limit it says how much now counts; over it, that the check stops and Medicaid continues", () => {
    const near = needCard(99_950);
    expect(near.r.checkAfter).toBe(near.r.checkBaseline);
    expect(near.r.explanation.plain).toContain("This gift takes it to $100,088, so $88 counts toward her savings, $1,328 in all on December 1, 2026. That is within the $2,000 limit");
    expect(near.es).toContain("Este regalo la lleva a $100,088, así que $88 cuentan como ahorros, $1,328 en total el 1 de diciembre de 2026.");
    const over = needCard(100_700);
    expect(over.r.checkAfter).toBe(0);
    expect(over.r.checkBaseline).toBe(1029);
    expect(over.r.explanation.plain).toMatch(/SSI cash stops while it stays over, and Medicaid continues: her January 2027 check would be \$0\./);
    expect(over.es).toMatch(/no se paga SSI en efectivo, y Medicaid continúa: su cheque de enero de 2027 sería de \$0\./);
    // With a balance well under $100,000 the card reads as it always has.
    expect(needCard(0).r.explanation.plain).toMatch(/^A gift to her ABLE account is not counted, and the first \$100,000 in it does not count toward savings\./);
  });

  it("the router fills the ABLE account only to $100,000, hands back the rest, and keeps the check whole", () => {
    const needs: OpenNeed[] = SAMPLE.needs.map((n, i) => ({ id: i + 1, title: n.title, category: n.category, route: n.route, payeeName: n.payeeName, payeeAccount: n.payeeAccount, amount: Number(n.amount), funded: 0, recurring: n.recurring }));
    const profile = { ...pageProfile({ household: { profile: SAMPLE.profile }, payments: [] }), ableBalance: 99_950 };
    const r = routeGift(1_400, needs, "2026-11-10", profile);
    expect(r.lines.map((l) => [l.title, l.amount])).toEqual([["Wheelchair repair", 420], ["Laptop for college", 649], ["Electric bill, this month", 50], ["Therapy co-pay", 90]]);
    expect([r.unplaced, r.ableFull, r.checkWithRouting, r.baseline]).toEqual([191, "balance", 1029, 1029]);
    // Past $100,000 the ABLE need is routed around: the shops are paid, the account gets nothing, the rest is handed back.
    const full = routeGift(1_400, needs, "2026-11-10", { ...profile, ableBalance: 100_700 });
    expect(full.lines.map((l) => l.title)).toEqual(["Wheelchair repair", "Laptop for college", "Therapy co-pay"]);
    expect([full.unplaced, full.ableFull, full.checkWithRouting]).toEqual([241, "balance", 1029]);
    // Savings already over the limit: the check is $0 either way, and the router still never sends rent to the landlord.
    const rent: OpenNeed[] = [{ id: 9, title: "Rent", category: "rent", route: "vendor", payeeName: "Landlord", payeeAccount: "vendor:landlord", amount: 500, funded: 0, recurring: true }];
    const overSavings = routeGift(500, rent, "2026-11-10", { ...profile, ableBalance: 0, ableEligible: false, savings: 2_500 });
    expect([overSavings.lines.length, overSavings.unplaced, overSavings.baseline]).toEqual([0, 500, 0]);
  });

  it("MCP plan_gift on the page says why money is handed back", async () => {
    page.ableBalance = 99_950;
    const out = await run("plan_gift", { slug: "maya", amount: 1_400 });
    expect(out.data?.able_full).toBe("balance");
    expect(out.data?.unplaced).toBe(191);
    expect(out.text).toContain("$191 has no benefit-safe place right now: her ABLE account would pass $100,000, and past that a deposit counts toward her savings.");
    page.ableBalance = 0;
    expect((await run("plan_gift", { slug: "maya", amount: 500 })).data?.able_full).toBeNull();
  });

  it("MCP check_gift takes the ABLE balance and answers with the consequence and the route that keeps the check", async () => {
    const out = await run("check_gift", { amount: 1_500, delivery: "able", category: "other", date: "2026-11-10", able_balance: 99_950, savings: 1_240 });
    expect(out.data).toMatchObject({ check_before: 1029, check_after: 0, best_route: "item", check_with_best_route: 1029, able_balance_on_next_first: 101_450, resource_status: "able_suspension" });
    expect(out.data?.rule_ids).toEqual(expect.arrayContaining(["R-ABLE-01", "R-ABLE-03", "R-RES-01"]));
    expect(out.text).toContain("This gift takes it to $101,450, so $1,450 counts toward their savings");
  });

  it("POST /api/v1/check-gift answers the same, and the profile schema takes the balance", async () => {
    const body = { gift: { amount: 1_500, delivery: "able", category: "other", date: "2026-11-10" }, profile: { ableBalance: 99_950 } };
    expect(CheckGiftRequest.safeParse(body).success).toBe(true);
    const res = await checkGift(post("/api/v1/check-gift", body));
    const { data } = await res.json();
    expect(data).toMatchObject({ check_after: 0, best_route: "item", check_with_best_route: 1029, able_balance_on_next_first: 101_450, resource_status: "able_suspension", over_savings_limit: true, savings_on_next_first: 2_690 });
    expect(data.routes.find((r: { delivery: string }) => r.delivery === "able")).toEqual({ delivery: "able", check: 0, possible: true, reason: "able_over_resource_limit" });
    expect(data.trace.resources).toMatchObject({ on: "2027-01-01", ableExcess: 1_450, over: true });
  });
});

describe("weekly rent and a shared household on the API and MCP", () => {
  it("check-gift and MCP check_gift convert a weekly rent; the schema refuses a frequency it does not know", async () => {
    const gift = { amount: 25, delivery: "vendor", category: "rent", recurring: true, every: "week", date: "2026-04-06" };
    const res = await checkGift(post("/api/v1/check-gift", { gift }));
    const { data } = await res.json();
    expect([data.trace.ismValue, data.check_after]).toEqual([108.33, 905.67]);
    expect(data.rule_ids).toContain("R-SHEL-06");
    const mcp = await run("check_gift", { amount: 25, delivery: "vendor", category: "rent", recurring: true, every: "week", date: "2026-04-06" });
    expect(mcp.data?.check_after).toBe(905.67);
    expect(CheckGiftRequest.safeParse({ gift: { ...gift, every: "day" } }).success).toBe(false);
  });

  it("plan-month and MCP check_gift divide housing help among the household", async () => {
    const body = { gifts: [{ amount: 1200, delivery: "vendor", category: "property_tax", date: "2026-03-15", giver: "sibling", covers: { from: "2025-06", to: "2026-05" } }], profile: { householdSize: 2, savings: 0 } };
    expect(PlanMonthRequest.safeParse(body).success).toBe(true);
    const res = await planMonth(post("/api/v1/plan-month", body));
    const { data } = await res.json();
    expect(data.months.map((m: { month: string; ismValue: number }) => [m.month, m.ismValue])).toEqual([["2026-03", 351.33], ["2026-04", 50], ["2026-05", 50]]);
    const mcp = await run("check_gift", { amount: 300, delivery: "vendor", category: "rent", recurring: true, date: "2026-04-10", household_size: 3 });
    expect(mcp.data?.rule_ids).toContain("R-SHEL-07");
    // $300 divided by three, $100, less the $20 general exclusion.
    expect(mcp.data?.check_after).toBe(914);
  });
});
