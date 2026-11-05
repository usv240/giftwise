/**
 * The calendar's planner: when some gifts will arrive as cash anyway, it moves each one by at most a few days so that
 * it lands where SSI's own exclusions cover more of it: the $20 general exclusion is per month, and the $60 for
 * one-time gifts is per calendar quarter, so two cash gifts in one month or quarter share what two in different ones
 * would each get. It never changes an amount or a route, only the day, and only within the window the giver allows.
 * Pure and deterministic: the browser runs it, the tests run it, and the rules engine scores every candidate.
 */
import { addMonths, monthOf, type Profile } from "@/lib/rules";
import { calendarModel, type CalGift, type View } from "./model";

export type PlannedMove = { id: string; giver: string; amount: number; from: string; to: string; kept: number };
export type DatePlan = { moves: PlannedMove[]; before: number; after: number; kept: number; windowDays: number };

const day = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The days worth trying for one gift: where it is, and the nearest day in each other month inside the window, same year. */
function candidates(date: string, windowDays: number) {
  const out = new Map<string, string>([[monthOf(date), date]]);
  for (let n = 1; n <= windowDays; n++) {
    for (const d of [day(date, -n), day(date, n)]) if (d.slice(0, 4) === date.slice(0, 4) && !out.has(monthOf(d))) out.set(monthOf(d), d);
  }
  return [...out.values()];
}

/** Every check the span pays: the total the planner raises, and how many are $0. */
function score(gifts: CalGift[], profile: Profile, view: View, span: { first: string; last: string }) {
  const checks = calendarModel(gifts, profile, view, span).checks;
  return { total: round2(checks.reduce((a, c) => a + c.amount, 0)), zero: checks.filter((c) => c.amount < 0.005).length, byPay: new Map(checks.map((c) => [c.paidOn, c.amount])) };
}
const total = (gifts: CalGift[], profile: Profile, view: View, span: { first: string; last: string }) => score(gifts, profile, view, span).total;

/**
 * Coordinate search: for each gift that counts, try its candidate days with every other gift held where it is, keep
 * the day that raises the total most (ties keep the gift where it was), and repeat until nothing improves.
 * A month with no SSI check at all can affect Medicaid in many states, so a move is never allowed to add a $0 check,
 * or to land a gift in a month whose check is already $0, even when the total would rise.
 */
export function planDates(gifts: CalGift[], profile: Profile, view: View, windowDays = 7): DatePlan {
  const months = gifts.map((g) => monthOf(g.date)).sort();
  if (!months.length) return { moves: [], before: 0, after: 0, kept: 0, windowDays };
  const span = { first: addMonths(months[0], -1), last: addMonths(months.at(-1)!, 1) };
  const counts = (g: CalGift) => view === "cash" || g.delivery === "cash";
  let cur = gifts.map((g) => ({ ...g }));
  let now = score(cur, profile, view, span);
  const before = now.total;
  let best = before;
  for (let pass = 0; pass < 4; pass++) {
    let improved = false;
    for (let i = 0; i < cur.length; i++) {
      const g = cur[i];
      if (!counts(g)) continue;
      const original = gifts.find((x) => x.id === g.id)!.date;
      for (const d of candidates(original, windowDays)) {
        if (d === g.date) continue;
        if ((now.byPay.get(`${addMonths(monthOf(d), 2)}-01`) ?? 1) < 0.005) continue;
        const trial = cur.map((x, j) => (j === i ? { ...x, date: d } : x));
        const t = score(trial, profile, view, span);
        if (t.total > best + 0.004 && t.zero <= now.zero) {
          best = t.total;
          cur = trial;
          now = t;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  // Each move, with what it keeps when applied in order on top of the ones before it.
  const moves: PlannedMove[] = [];
  let running = gifts.map((g) => ({ ...g }));
  let last = before;
  for (const g of cur) {
    const was = gifts.find((x) => x.id === g.id)!;
    if (was.date === g.date) continue;
    running = running.map((x) => (x.id === g.id ? { ...x, date: g.date } : x));
    const t = total(running, profile, view, span);
    moves.push({ id: g.id, giver: g.giver, amount: g.amount, from: was.date, to: g.date, kept: round2(t - last) });
    last = t;
  }
  return { moves, before, after: best, kept: round2(best - before), windowDays };
}
