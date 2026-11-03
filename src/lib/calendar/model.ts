import { addMonths, computeMonth, monthName, monthOf, planMonths, usd, type Gift, type Profile } from "@/lib/rules";

/**
 * A person's benefit calendar: every gift on the day it arrived, the day each month's report to Social Security is due,
 * and the check each 1st of the month pays. SSI works in calendar months (income in one month sets the check two months
 * later) and calendar quarters (the $60 exclusion for one-time gifts), so where a gift lands on the calendar matters.
 * Pure: the page reruns it in the browser whenever a gift is moved.
 */
export type CalGift = Gift & { giver: string; paidTo: string; need: string };
export type View = "given" | "cash";
export type CalEvent = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  allDay: true;
  resourceId: "kept" | "counts" | "ssa";
  draggable: boolean;
  /** Shown in the tooltip: what the rules said about this event. */
  note: string;
};

const clean = (s: string) => s.replace(/[<>&"]/g, "").slice(0, 60);
const nextDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const COUNTED = new Set(["unearned_cash", "unearned_in_kind", "ism_shelter"]);

/** span: the first and last income months to show checks for, so two runs can be compared month for month. */
export function calendarModel(gifts: CalGift[], profile: Profile, view: View, span?: { first: string; last: string }) {
  const asView = gifts.map((g) => (view === "cash" ? { ...g, delivery: "cash" as const } : g));
  const plan = planMonths(asView, profile);
  const result = new Map(plan.gifts.map((r) => [r.gift.id, r]));
  const monthsWithGifts = plan.months.map((m) => m.month);
  const traceOf = new Map(plan.months.map((m) => [m.month, m]));

  const events: CalEvent[] = gifts.map((g) => {
    const r = result.get(g.id);
    const counts = r ? COUNTED.has(r.treatment.kind) : false;
    const how = view === "cash" ? "in cash" : g.delivery === "able" ? "to the ABLE account" : g.delivery === "cash" ? "in cash" : `to ${clean(g.paidTo)}`;
    return {
      id: g.id,
      name: `${usd(g.amount)} ${how}`,
      startDate: g.date,
      endDate: nextDay(g.date),
      allDay: true,
      resourceId: counts ? "counts" : "kept",
      draggable: true,
      note: `${clean(g.giver)}, for ${clean(g.need).toLowerCase()}. ${r?.explanation.plain ?? ""}`,
    };
  });

  // Every month from the first gift to two months after the last, so each income month's check is on the calendar.
  const first = [monthsWithGifts[0], span?.first].filter(Boolean).sort()[0];
  const last = [monthsWithGifts.at(-1), span?.last].filter(Boolean).sort().at(-1);
  const checks: { paidOn: string; incomeMonth: string; amount: number }[] = [];
  if (first && last) {
    for (let m = first; m <= addMonths(last, 2); m = addMonths(m, 1)) {
      const income = addMonths(m, -2);
      const t = traceOf.get(income) ?? computeMonth(income, [], profile);
      checks.push({ paidOn: `${m}-01`, incomeMonth: income, amount: t.check });
    }
    for (const m of monthsWithGifts) {
      const due = `${addMonths(m, 1)}-10`;
      events.push({
        id: `due-${m}`,
        name: `Report due for ${monthName(m)}`,
        startDate: due,
        endDate: nextDay(due),
        allDay: true,
        resourceId: "ssa",
        draggable: false,
        note: `Changes in income during ${monthName(m)}, including help from family, are due to Social Security by the 10th (20 CFR 416.714).`,
      });
    }
  }
  for (const c of checks) {
    events.push({
      id: `check-${c.paidOn}`,
      name: `SSI check ${usd(c.amount)}`,
      startDate: c.paidOn,
      endDate: nextDay(c.paidOn),
      allDay: true,
      resourceId: "ssa",
      draggable: false,
      note: `Paid on the 1st, set by ${monthName(c.incomeMonth)} income (two months earlier). When the 1st falls on a weekend or holiday, SSA pays the business day before.`,
    });
  }
  return { events, checks };
}

/** Which checks changed between two runs, for the "what moving it did" list. */
export function checkChanges(before: { paidOn: string; amount: number }[], after: { paidOn: string; amount: number }[]) {
  const was = new Map(before.map((c) => [c.paidOn, c.amount]));
  const now = new Map(after.map((c) => [c.paidOn, c.amount]));
  const days = [...new Set([...was.keys(), ...now.keys()])].sort();
  return days
    .map((d) => ({ paidOn: d, before: was.get(d) ?? null, after: now.get(d) ?? null }))
    .filter((c) => c.before !== null && c.after !== null && Math.abs(c.before - c.after) >= 0.01) as { paidOn: string; before: number; after: number }[];
}

export const monthLabelOf = (iso: string) => `${monthName(monthOf(iso))} ${iso.slice(0, 4)}`;
