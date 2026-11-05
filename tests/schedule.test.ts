import { describe, expect, it } from "vitest";
import sample from "../content/sample-year.json";
import { calendarModel, type CalGift } from "@/lib/calendar/model";
import { planDates } from "@/lib/calendar/schedule";
import { DEFAULT_PROFILE } from "@/lib/rules";

type S = { date: string; giver: string; need: string; paidTo: string; delivery: CalGift["delivery"]; category: string; amount: number; recurring: boolean };
const gifts: CalGift[] = (sample.gifts as S[]).map((g, i) => ({ id: `s${i}`, ...g, category: g.category as CalGift["category"] }));
const profile = { ...DEFAULT_PROFILE, savings: 1240 };
const days = (a: string, b: string) => Math.abs(new Date(`${a}T12:00:00Z`).getTime() - new Date(`${b}T12:00:00Z`).getTime()) / 86_400_000;

describe("the calendar's planner", () => {
  const plan = planDates(gifts, profile, "cash");

  it("keeps more of the checks for the sample year as cash, moving gifts by a week or less within their year", () => {
    expect(plan.kept).toBeGreaterThan(0);
    expect(plan.after).toBeCloseTo(plan.before + plan.kept, 2);
    for (const m of plan.moves) {
      expect(days(m.from, m.to)).toBeLessThanOrEqual(7);
      expect(m.to.slice(0, 4)).toBe(m.from.slice(0, 4));
      expect(m.kept).toBeGreaterThan(0);
    }
  }, 30_000);

  it("never adds a month with no check", () => {
    const months = gifts.map((g) => g.date.slice(0, 7)).sort();
    const span = { first: months[0], last: months.at(-1)! };
    const zero = (g: CalGift[]) => calendarModel(g, profile, "cash", span).checks.filter((c) => c.amount < 0.005).length;
    const after = gifts.map((g) => ({ ...g, date: plan.moves.find((m) => m.id === g.id)?.to ?? g.date }));
    expect(zero(after)).toBeLessThanOrEqual(zero(gifts));
  }, 30_000);

  it("finds nothing to move when every gift is paid the Giftwise way", () => {
    expect(planDates(gifts, profile, "given").moves).toEqual([]);
  }, 30_000);
});
