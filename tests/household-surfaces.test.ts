import { describe, expect, it, vi } from "vitest";
import { CheckGiftRequest } from "@/lib/api/schemas";
import { POST as checkGift } from "@/app/api/v1/check-gift/route";
import { TOOLS } from "@/lib/mcp/tools";
import { SAMPLE, pageProfile } from "@/lib/households";
import { ruleSentenceEs } from "@/lib/i18n/gift-rules";
import { routeGift, type OpenNeed } from "@/lib/routing";
import { evaluateGift, type Category, type Delivery, type Profile } from "@/lib/rules";

/**
 * R-SHEL-08 and the loan rules on every surface that takes a gift: where the profile shows she lives in someone else's
 * household and pays less than her share, the need card, MCP check_gift and plan_gift, and POST /api/v1/check-gift say
 * the household already lowers the check, so no answer calls a gift fine without it. The running server's answers are
 * checked by tests/e2e/api.mjs.
 */

// plan_gift reads a gift page from the database; here the page is Maya's sample, living in her sister's household.
const page = vi.hoisted(() => ({ household: {} as Record<string, unknown> }));
vi.mock("@/lib/households", async (orig) => {
  const real = await orig<typeof import("@/lib/households")>();
  const row = (n: (typeof real.SAMPLE.needs)[number], i: number) => ({ ...n, id: i + 1, householdId: 1, sortOrder: i, status: "open", funded: "0", link: null, archivedAt: null });
  return {
    ...real,
    getHousehold: async (slug: string) =>
      slug === "maya" ? { household: { id: 1, slug: "maya", name: "Maya", isSample: true, profile: { ...real.SAMPLE.profile, ...page.household } }, needs: real.SAMPLE.needs.map(row), payments: [], payouts: [] } : null,
  };
});

const run = (name: string, args: Record<string, unknown>) => {
  const tool = TOOLS.find((t) => t.name === name)!;
  return tool.run(tool.input.parse(args) as never, { origin: "http://localhost" });
};
const post = (path: string, body: unknown) => new Request(`http://localhost${path}`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.78" }, body: JSON.stringify(body) });

/** Grayson's household from POMS SI 00835.160 G: $450 a month for three, and she pays $100 of her $150 share. */
const SHORT = { livesInAnothersHousehold: true, householdSize: 3, householdCosts: 450, householdPays: 100 } as const;
const wheelchair = SAMPLE.needs.find((n) => n.route === "vendor")!;
const needCard = (household: Partial<Profile>) => {
  const profile = pageProfile({ household: { profile: { ...SAMPLE.profile, ...household } }, payments: [] });
  const r = evaluateGift({ id: "n1", date: "2026-04-10", amount: Number(wheelchair.amount), delivery: wheelchair.route as Delivery, category: wheelchair.category as Category, recurring: wheelchair.recurring }, profile);
  return { r, es: ruleSentenceEs(r, profile.couple) };
};

describe("a household that already lowers the check", () => {
  it("the need card says so in English and Spanish, and reads as before when she pays her share", () => {
    const short = needCard(SHORT);
    expect([short.r.checkBaseline, short.r.checkAfter]).toEqual([662.67, 662.67]);
    expect(short.r.explanation.plain).toContain("already reduced by a third, $331.33, gift or not. Paying at least $130 a month toward the household's costs would end that.");
    expect(short.es).toContain("ya tiene una reducción de un tercio, $331.33, con o sin regalo. Pagar al menos $130 al mes de los gastos del hogar terminaría eso.");
    const paid = needCard({ ...SHORT, householdPays: 150 });
    expect(paid.r.checkAfter).toBe(994);
    expect(paid.r.explanation.plain).not.toContain("household");
  });

  it("the router keeps her check at what the household leaves it, and never sends rent where it would lower it further", () => {
    const needs: OpenNeed[] = SAMPLE.needs.map((n, i) => ({ id: i + 1, title: n.title, category: n.category, route: n.route, payeeName: n.payeeName, payeeAccount: n.payeeAccount, amount: Number(n.amount), funded: 0, recurring: n.recurring }));
    const r = routeGift(500, needs, "2026-04-10", { ...pageProfile({ household: { profile: { ...SAMPLE.profile, ...SHORT } }, payments: [] }) });
    expect([r.baseline, r.checkWithRouting]).toEqual([662.67, 662.67]);
  });

  it("MCP plan_gift says the household already lowers the check", async () => {
    page.household = SHORT;
    const out = await run("plan_gift", { slug: "maya", amount: 500 });
    expect(out.text).toContain("pays $100 of her $150 share of its costs");
    expect(out.data?.household).toMatchObject({ rule: "vtr", pro_rata_share: 150, pays: 100, lowers_check_before_gift: true });
    page.household = {};
    expect((await run("plan_gift", { slug: "maya", amount: 500 })).data?.household).toBeNull();
  });

  it("MCP check_gift takes the household's costs and what they pay, and answers with the household's part", async () => {
    const out = await run("check_gift", { amount: 420, delivery: "vendor", category: "equipment", date: "2026-04-10", lives_in_anothers_household: true, household_size: 3, household_costs: 450, household_pays: 100 });
    expect(out.data).toMatchObject({ check_before: 662.67, check_after: 662.67, household: { rule: "vtr", pro_rata_share: 150, short_by: 50, lowers_check_before_gift: true } });
    expect(out.text).toContain("They live in someone else's household and pay $100 of their $150 share of its costs");
    const paid = await run("check_gift", { amount: 420, delivery: "vendor", category: "equipment", date: "2026-04-10", lives_in_anothers_household: true, household_size: 3, household_costs: 450, household_pays: 175 });
    expect(paid.data).toMatchObject({ check_after: 994, household: { rule: "none", sharing: true, lowers_check_before_gift: false } });
  });

  it("POST /api/v1/check-gift answers the same, and the profile schema takes the household's costs", async () => {
    const body = { gift: { amount: 420, delivery: "vendor", category: "equipment", date: "2026-04-10" }, profile: SHORT };
    expect(CheckGiftRequest.safeParse(body).success).toBe(true);
    const { data } = await (await checkGift(post("/api/v1/check-gift", body))).json();
    expect(data).toMatchObject({ check_before: 662.67, check_after: 662.67, household: { rule: "vtr", pro_rata_share: 150, pays: 100, short_by: 50, sharing: false, lowers_check_before_gift: true } });
    expect(data.household.plain).toContain("already reduced by a third");
    expect(data.rule_ids).toEqual(expect.arrayContaining(["R-SHEL-VTR", "R-SHEL-08"]));
    // Living on her own, the field is null.
    const alone = await (await checkGift(post("/api/v1/check-gift", { gift: body.gift }))).json();
    expect(alone.data.household).toBeNull();
  });
});

describe("loans on the API and MCP", () => {
  it("POST /api/v1/check-gift: a bona fide cash loan is not income; the same cash with no agreement to repay counts", async () => {
    const loan = { mustRepay: true, agreedWhenGiven: true, feasiblePlan: true };
    const lent = await (await checkGift(post("/api/v1/check-gift", { gift: { amount: 900, delivery: "cash", category: "other", date: "2026-04-10", loan }, profile: { savings: 0 } }))).json();
    expect([lent.data.check_after, lent.data.counted_amount, lent.data.rule_ids]).toEqual([994, 0, ["R-LOAN-01"]]);
    const notLent = await (await checkGift(post("/api/v1/check-gift", { gift: { amount: 900, delivery: "cash", category: "other", date: "2026-04-10", loan: { ...loan, agreedWhenGiven: false } }, profile: { savings: 0 } }))).json();
    expect(notLent.data.check_after).toBeLessThan(994);
    expect(notLent.data.explanation.plain).toMatch(/^SSA would not treat this as a loan/);
    expect(CheckGiftRequest.safeParse({ gift: { amount: 9, delivery: "cash", loan: { mustRepay: "yes" } } }).success).toBe(false);
  });

  it("MCP check_gift: a utility bill paid as a loan she repays for her $75 share of two counts nothing", async () => {
    const out = await run("check_gift", { amount: 150, delivery: "vendor", category: "utility", date: "2026-04-10", household_size: 2, loan: { must_repay: true, agreed_when_given: true, feasible_plan: true, repay: 75 } });
    expect(out.data?.check_after).toBe(994);
    expect(out.data?.rule_ids).toContain("R-LOAN-02");
  });
});
