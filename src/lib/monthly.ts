import { randomBytes } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { db, schema } from "@/lib/db";
import { getHousehold, withAbleSoFar } from "@/lib/households";
import { routeGift, type OpenNeed, type RoutedGift } from "@/lib/routing";
import { DEFAULT_PROFILE, addMonths, computeMonth, evaluateGift, monthName, monthOf, usd, type Profile } from "@/lib/rules";

/**
 * Monthly gifts: the same amount every month, routed again by the rules engine each month.
 *
 * Each month starts from that month's needs. A recurring need (rent, the electric bill) opens again with what it has
 * received that month; a one-time need drops off once it is paid in full. The split can change from one month to the
 * next, so each month records what changed and why, and the giver approves a fresh PayPal order that pays every
 * recipient directly. Giftwise keeps no payment method: in PayPal's sandbox a saved PayPal wallet can only pay the
 * platform's own account (a vault_id charge to another payee returns BILLING_AGREEMENT_NOT_FOUND, tested 2026-11-04),
 * so an automatic charge would mean Giftwise holding the money. One approval a month keeps it going straight to each payee.
 */

export type NeedRow = typeof schema.needs.$inferSelect;
export type PaymentRow = typeof schema.payments.$inferSelect;
export type Change = { kind: "added" | "removed" | "changed"; title: string; payee: string; from: number; to: number; why: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The needs as they stand in a month: recurring ones count only what they received for that month. A payment made for
 * a monthly gift counts toward the month it was planned for (orderMonth), even when it was paid early.
 */
export function needsForMonth(needs: NeedRow[], payments: Pick<PaymentRow, "needId" | "amount" | "capturedAt" | "status" | "orderId">[], month: string, orderMonth: Map<string, string> = new Map()): OpenNeed[] {
  const monthOfPayment = (p: Pick<PaymentRow, "capturedAt" | "orderId">) => orderMonth.get(p.orderId) ?? (p.capturedAt ? monthOf(p.capturedAt.toISOString()) : "");
  return needs
    .filter((n) => n.recurring || n.status !== "paid")
    .map((n) => {
      const funded = n.recurring
        ? round2(payments.filter((p) => p.needId === n.id && p.status === "captured" && monthOfPayment(p) === month).reduce((s, p) => s + Number(p.amount), 0))
        : Number(n.funded);
      return { id: n.id, title: n.title, category: n.category, route: n.route, payeeName: n.payeeName, payeeAccount: n.payeeAccount, amount: Number(n.amount), funded, recurring: n.recurring };
    });
}

/** What changed from last month's split to this month's, each with the reason in plain words. */
export function diffPlans(prev: RoutedGift | null, next: RoutedGift, needs: OpenNeed[], ableName: string): Change[] {
  if (!prev) return [];
  const key = (l: RoutedGift["lines"][number]) => l.referenceId;
  const before = new Map(prev.lines.map((l) => [key(l), l]));
  const after = new Map(next.lines.map((l) => [key(l), l]));
  const out: Change[] = [];
  for (const [k, l] of before) {
    if (after.has(k)) continue;
    const need = needs.find((n) => `need-${n.id}` === k);
    out.push({
      kind: "removed",
      title: l.title,
      payee: l.payeeName,
      from: l.amount,
      to: 0,
      why: l.payeeName === ableName ? `The needs take all of this month's gift, so nothing is left over for ${ableName}.` : !need ? `${l.title[0].toUpperCase()}${l.title.slice(1)} is paid in full, so nothing goes there now.` : "Earlier needs on the page take all of this month's gift.",
    });
  }
  for (const [k, l] of after) {
    const was = before.get(k);
    if (!was) {
      out.push({
        kind: "added",
        title: l.title,
        payee: l.payeeName,
        from: 0,
        to: l.amount,
        why: l.payeeName === ableName ? `What is left after the needs goes to ${ableName}, where it does not count as income or savings.` : `Next on the page, so it gets what is left after the needs before it.`,
      });
    } else if (round2(was.amount) !== round2(l.amount)) {
      const need = needs.find((n) => `need-${n.id}` === k);
      const left = need ? round2(need.amount - need.funded) : null;
      out.push({
        kind: "changed",
        title: l.title,
        payee: l.payeeName,
        from: was.amount,
        to: l.amount,
        why: need && left !== null && l.amount === left && l.amount < was.amount ? `Only ${usd(left)} is still needed.` : l.payeeName === ableName ? `${ableName} gets what is left after the needs.` : l.amount > was.amount ? "Needs before it take less this month, so more is left for this one." : "Needs before it take more this month, so less is left for this one.",
      });
    }
  }
  return out;
}

/** Plan one month for a monthly gift: route the amount over that month's needs. Pure, for the page and the tests. */
export function planFor(amount: number, needs: OpenNeed[], month: string, profile: Profile, ableName: string): RoutedGift {
  return routeGift(amount, needs, `${month}-01`, profile, ableName);
}

/** Which month each monthly-gift order paid for, across a household's monthly gifts. */
export async function orderMonths(householdId: number) {
  const rows = await db()
    .select({ orderId: schema.monthlyRuns.orderId, month: schema.monthlyRuns.month })
    .from(schema.monthlyRuns)
    .innerJoin(schema.monthlyGifts, eq(schema.monthlyRuns.monthlyGiftId, schema.monthlyGifts.id))
    .where(eq(schema.monthlyGifts.householdId, householdId));
  return new Map(rows.filter((r) => r.orderId).map((r) => [r.orderId!, r.month]));
}

async function load(token: string) {
  const [g] = await db().select().from(schema.monthlyGifts).where(eq(schema.monthlyGifts.token, token)).limit(1);
  if (!g) return null;
  const [h] = await db().select().from(schema.households).where(eq(schema.households.id, g.householdId)).limit(1);
  if (!h) return null;
  const data = await getHousehold(h.slug);
  if (!data) return null;
  const runs = await db().select().from(schema.monthlyRuns).where(eq(schema.monthlyRuns.monthlyGiftId, g.id)).orderBy(asc(schema.monthlyRuns.month));
  return { gift: g, data, runs };
}

/** Whether a run's PayPal order has been captured, from Giftwise's own payment rows. */
async function paidOrder(orderId: string | null) {
  if (!orderId) return false;
  const rows = await db().select({ status: schema.payments.status }).from(schema.payments).where(eq(schema.payments.orderId, orderId));
  return rows.length > 0 && rows.every((r) => r.status === "captured");
}

/** Plan a month (once) and return it. Runs the rules on the household as it stands now. */
export async function planMonth(token: string, month: string) {
  const s = await load(token);
  if (!s) return null;
  const existing = s.runs.find((r) => r.month === month);
  if (existing) return existing;
  const profile = withAbleSoFar({ ...DEFAULT_PROFILE, ...(s.data.household.profile as Partial<Profile>) }, s.data.payments);
  const ableName = `${s.data.household.name}'s ABLE account`;
  const needs = needsForMonth(s.data.needs, s.data.payments, month, await orderMonths(s.data.household.id));
  const plan = planFor(Number(s.gift.amount), needs, month, profile, ableName);
  const prev = [...s.runs].reverse().find((r) => r.month < month);
  const changes = diffPlans((prev?.plan as RoutedGift) ?? null, plan, needs, ableName);
  const [run] = await db().insert(schema.monthlyRuns).values({ monthlyGiftId: s.gift.id, month, plan, changes }).onConflictDoNothing().returning();
  await audit("system", "monthly.planned", `monthly:${s.gift.id}:${month}`, { amount: plan.amount, units: plan.lines.map((l) => ({ ref: l.referenceId, amount: l.amount, route: l.route, rules: l.ruleIds })), changes: changes.length });
  return run ?? (await db().select().from(schema.monthlyRuns).where(and(eq(schema.monthlyRuns.monthlyGiftId, s.gift.id), eq(schema.monthlyRuns.month, month))).limit(1))[0];
}

/** The monthly gifts still active, for the Render Workflow that plans each one on the 1st. */
export async function activeMonthlyIds() {
  const rows = await db().select({ id: schema.monthlyGifts.id }).from(schema.monthlyGifts).where(eq(schema.monthlyGifts.status, "active"));
  return rows.map((r) => r.id);
}

/** Plan one monthly gift's month by its id (the workflow never handles a giver's private link). */
export async function planMonthById(id: number, month: string) {
  const [g] = await db().select({ token: schema.monthlyGifts.token }).from(schema.monthlyGifts).where(eq(schema.monthlyGifts.id, id)).limit(1);
  if (!g) return null;
  const run = await planMonth(g.token, month);
  return run ? { id, month, lines: ((run.plan as RoutedGift).lines ?? []).length, changes: ((run.changes as unknown[]) ?? []).length } : null;
}

/** Start a monthly gift, optionally recording the gift the giver just paid as its first month. */
export async function startMonthly(o: { slug: string; amount: number; giverName?: string; firstOrderId?: string; month: string }) {
  const data = await getHousehold(o.slug);
  if (!data) return null;
  const token = randomBytes(18).toString("base64url");
  const [g] = await db()
    .insert(schema.monthlyGifts)
    .values({ token, householdId: data.household.id, giverName: (o.giverName ?? "").slice(0, 60), amount: o.amount.toFixed(2) })
    .returning();
  if (o.firstOrderId) {
    const rows = await db().select().from(schema.payments).where(eq(schema.payments.orderId, o.firstOrderId));
    // Only an order for this household, already captured and part of the page's current round, becomes the first month.
    if (rows.length && rows.every((r) => r.householdId === data.household.id && r.status === "captured" && !r.archivedAt)) {
      const profile = { ...DEFAULT_PROFILE, ...(data.household.profile as Partial<Profile>) };
      const date = `${o.month}-01`;
      const lines: RoutedGift["lines"] = rows.map((r) => {
        const need = data.needs.find((n) => n.id === r.needId);
        return { referenceId: r.referenceId, needId: r.needId, title: need?.title ?? "savings for later", payeeName: r.payeeName, payeeAccount: need?.payeeAccount ?? "able", route: r.route as RoutedGift["lines"][number]["route"], category: (need?.category ?? "other") as RoutedGift["lines"][number]["category"], amount: Number(r.amount), ruleIds: [], plain: "" };
      });
      const total = round2(lines.reduce((s, l) => s + l.amount, 0));
      // The same figures a planned month carries: the check as given, as cash, and with no gift at all.
      const plan: RoutedGift = {
        amount: total,
        lines,
        unplaced: 0,
        checkIfCash: evaluateGift({ id: "cash", date, amount: total, delivery: "cash", category: "other" }, profile).checkAfter,
        checkWithRouting: computeMonth(o.month, lines.map((l, i) => ({ id: `l${i}`, date, amount: l.amount, delivery: l.route, category: l.category })), profile).check,
        baseline: computeMonth(o.month, [], profile).check,
      };
      await db().insert(schema.monthlyRuns).values({ monthlyGiftId: g.id, month: o.month, plan, changes: [], orderId: o.firstOrderId, status: "paid" }).onConflictDoNothing();
    }
  }
  await audit("person", "monthly.started", `monthly:${g.id}`, { slug: o.slug, amount: o.amount, firstOrderId: o.firstOrderId ?? null });
  return { token, id: g.id };
}

/** Record the PayPal order a month will be paid with. */
export async function attachOrder(token: string, month: string, orderId: string) {
  const s = await load(token);
  if (!s) return;
  await db().update(schema.monthlyRuns).set({ orderId }).where(and(eq(schema.monthlyRuns.monthlyGiftId, s.gift.id), eq(schema.monthlyRuns.month, month)));
}

/** Everything the giver's page shows: the gift, each month newest first with its status, and the household. */
export async function monthlyView(token: string, today: string) {
  const s = await load(token);
  if (!s) return null;
  // The current month is planned the first time the page is opened in it.
  if (s.gift.status === "active" && !s.runs.some((r) => r.month === monthOf(today))) await planMonth(token, monthOf(today));
  const fresh = (await load(token))!;
  const runs = await Promise.all(
    fresh.runs.map(async (r) => {
      const paid = r.status === "paid" || (await paidOrder(r.orderId));
      if (paid && r.status !== "paid") await db().update(schema.monthlyRuns).set({ status: "paid" }).where(eq(schema.monthlyRuns.id, r.id));
      return { month: r.month, label: `${monthName(r.month)} ${r.month.slice(0, 4)}`, plan: r.plan as RoutedGift, changes: r.changes as Change[], orderId: r.orderId, paid };
    }),
  );
  const last = runs.at(-1)?.month ?? monthOf(today);
  return {
    token,
    amount: Number(fresh.gift.amount),
    giverName: fresh.gift.giverName,
    status: fresh.gift.status,
    household: { id: fresh.data.household.id, slug: fresh.data.household.slug, name: fresh.data.household.name, profile: { ...DEFAULT_PROFILE, ...(fresh.data.household.profile as Partial<Profile>) } },
    runs: runs.reverse(),
    nextMonth: addMonths(last, 1),
  };
}

/** The monthly gifts recorded for a household, newest first (for the gift page owner's view and tests). */
export async function monthlyForHousehold(householdId: number) {
  return db().select().from(schema.monthlyGifts).where(eq(schema.monthlyGifts.householdId, householdId)).orderBy(desc(schema.monthlyGifts.createdAt));
}
