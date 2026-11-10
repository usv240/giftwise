import { randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { have, suiteName } from "./helpers/needs";

/**
 * A page that runs on the person's own facts, end to end on the database: made through the API with a profile, read by
 * the MCP tools and the organizer's manage link, changed through the manage link, and put back on the sample situation.
 * Sam lives in his mother's home and gets $600 of Social Security, so his check is $106 a month in 2027, not $1,029.
 * The ledger is mocked (no entries); every page made here is removed afterwards.
 */
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => "test") }));

const database = await have("database");

describe.skipIf(!database.ok)(suiteName("a page on the person's own facts: the API, the MCP tools and the manage link", "database", database), () => {
  const made: number[] = [];
  let m: {
    db: typeof import("@/lib/db");
    situation: typeof import("@/lib/situation");
    tools: typeof import("@/lib/mcp/tools");
    pages: typeof import("@/app/api/v1/gift-pages/route");
    manage: typeof import("@/app/api/manage/[token]/route");
    time: typeof import("@/lib/time");
  };
  const ctx = { origin: "http://localhost" };
  const from = `198.51.100.${1 + (randomBytes(1)[0] % 250)}`;
  const tool = (name: string) => m.tools.TOOLS.find((t) => t.name === name)!;
  let page: { slug: string; manage_url: string; situation: string; check: { amount: number; payment_month: string }; needs: { route: string; check_after: number }[] };

  beforeAll(async () => {
    process.env.DATABASE_URL ??= database.url;
    m = {
      db: await import("@/lib/db"),
      situation: await import("@/lib/situation"),
      tools: await import("@/lib/mcp/tools"),
      pages: await import("@/app/api/v1/gift-pages/route"),
      manage: await import("@/app/api/manage/[token]/route"),
      time: await import("@/lib/time"),
    };
    const res = await m.pages.POST(
      new Request("http://localhost/api/v1/gift-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": from },
        body: JSON.stringify({
          name: "Sam",
          pronoun: "he",
          organizer: "Test",
          needs: [
            { title: "Wheelchair cushion", amount: 120, category: "equipment", vendor: "a mobility shop" },
            { title: "Electric bill", amount: 90, category: "utility", recurring: true },
          ],
          profile: { livesInAnothersHousehold: true, otherUnearnedMonthly: 600 },
          profile_source: "letter",
        }),
      }),
    );
    const j = await res.json();
    expect(res.status, JSON.stringify(j.error)).toBe(200);
    page = j.data;
    const { db, schema } = m.db;
    const [h] = await db().select({ id: schema.households.id }).from(schema.households).where(eq(schema.households.slug, page.slug));
    made.push(h.id);
  });

  afterAll(async () => {
    if (!made.length) return;
    const { db, schema } = m.db;
    await db().delete(schema.needs).where(inArray(schema.needs.householdId, made));
    await db().delete(schema.households).where(inArray(schema.households.id, made));
  });

  /** His check with no gift for a gift made today: two months on, at that year's rate, from his own facts. */
  const expected = () => {
    const { profile } = m.situation.answersToProfile({ home: "other", benefits: 600 }, "he");
    return m.situation.checkFor(profile, m.time.today().slice(0, 7));
  };

  it("POST /api/v1/gift-pages with a profile: the page runs on his facts, and every need keeps his own check", () => {
    const e = expected();
    expect(e.check).toBeLessThan(400);
    expect(page.situation).toBe("own");
    expect(page.check).toEqual({ amount: e.check, payment_month: e.paymentMonth });
    expect(page.needs.map((n) => [n.route, n.check_after])).toEqual([
      ["vendor", e.check],
      ["able", e.check],
    ]);
  });

  it("get_gift_page names his own situation and check; plan_gift keeps it whole and shows cash lowering it", async () => {
    const e = expected();
    const read = await tool("get_gift_page").run({ slug: page.slug } as never, ctx);
    expect(read.data).toMatchObject({ situation: "own", check: { amount: e.check, payment_month: e.paymentMonth } });
    expect(read.text).toContain("Sam's own situation, as the organizer gave it: lives in someone else's home, $600 a month in Social Security or other benefits.");
    const plan = await tool("plan_gift").run({ slug: page.slug, amount: 300 } as never, ctx);
    expect(plan.data).toMatchObject({ check_with_giftwise: e.check, household: { rule: "vtr", lowers_check_before_gift: true } });
    expect((plan.data as { check_if_cash: number }).check_if_cash).toBeLessThan(e.check);
  });

  it("the manage link reads his facts, changes them, and puts the page back on the sample situation", async () => {
    const token = page.manage_url.replace("/manage/", "");
    const params = Promise.resolve({ token });
    const call = (method: string, body?: unknown) =>
      (method === "GET" ? m.manage.GET : m.manage.PATCH)(new Request(`http://localhost/api/manage/${token}`, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }), { params });

    const got = await (await call("GET")).json();
    expect(got.data.situation).toMatchObject({ kind: "own", source: "letter", given: ["livesInAnothersHousehold", "otherUnearnedMonthly"] });
    expect(got.data.check.amount).toBe(expected().check);

    // He now pays his $400 share of a $1,200 home of three, so living there no longer lowers his check.
    const sharing = await (await call("PATCH", { profile: { livesInAnothersHousehold: true, otherUnearnedMonthly: 600, householdSize: 3, householdCosts: 1200, householdPays: 400 }, profile_source: "answers" })).json();
    const full = m.situation.checkFor(m.situation.answersToProfile({}).profile, m.time.today().slice(0, 7)).check;
    expect(sharing.data.situation).toMatchObject({ kind: "own", source: "answers" });
    expect(sharing.data.check.amount).toBe(Math.round((full - 580) * 100) / 100);

    const back = await (await call("PATCH", { profile: null })).json();
    expect(back.data.situation.kind).toBe("sample");
    expect(back.data.check.amount).toBe(full);
    expect(back.data.profile.pronoun).toBe("he");

    const bad = await call("PATCH", { profile: { savings: -10 } });
    expect(bad.status).toBe(400);
  });
});
