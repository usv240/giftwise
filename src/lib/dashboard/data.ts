import { and, eq } from "drizzle-orm";
import sample from "../../../content/sample-year.json";
import { db, dbConfigured, schema } from "@/lib/db";
import { getHousehold } from "@/lib/households";
import { CATEGORY_LABEL, ROUTE_LABEL } from "./labels";
import { DEFAULT_PROFILE, monthOf, planMonths, type Category, type Delivery, type Gift, type Profile } from "@/lib/rules";

/** One gift, as the dashboard's "gifts" table sees it. Labels are what people read; delivery and category stay as codes for the rules engine. */
export type GiftRow = { date: string; giver: string; need: string; paidTo: string; route: string; delivery: Delivery; whatFor: string; category: Category; amount: number; source: string };
export type MonthRow = { month: string; given: number; checkWithGiftwise: number; checkIfCash: number; kept: number };

type Sample = { date: string; giver: string; need: string; paidTo: string; delivery: Delivery; category: Category; amount: number; recurring: boolean };

/** Her check for each income month, given the gifts as they were delivered, and if every one had been cash instead. */
export function monthsFor(gifts: (Gift & { recurring?: boolean })[], profile: Profile = DEFAULT_PROFILE): MonthRow[] {
  const routed = planMonths(gifts, profile).months;
  const cash = planMonths(gifts.map((g) => ({ ...g, delivery: "cash" as const })), profile).months;
  return routed.map((m, i) => {
    const given = gifts.filter((g) => monthOf(g.date) === m.month).reduce((s, g) => s + g.amount, 0);
    return { month: `${m.month}-01`, given, checkWithGiftwise: m.check, checkIfCash: cash[i].check, kept: Math.round((m.check - cash[i].check) * 100) / 100 };
  });
}

/** The sample year plus every gift actually paid on this site for the sample household. */
export async function dashboardData() {
  const rows: GiftRow[] = (sample.gifts as Sample[]).map((g) => ({
    date: g.date,
    giver: g.giver,
    need: g.need,
    paidTo: g.paidTo,
    route: ROUTE_LABEL[g.delivery],
    delivery: g.delivery,
    whatFor: CATEGORY_LABEL[g.category],
    category: g.category,
    amount: g.amount,
    source: "Sample year",
  }));
  if (dbConfigured()) {
    const data = await getHousehold("maya");
    if (data) {
      const live = await db()
        .select()
        .from(schema.payments)
        .where(and(eq(schema.payments.householdId, data.household.id), eq(schema.payments.status, "captured")));
      for (const p of live) {
        const need = data.needs.find((n) => n.id === p.needId);
        const category = (need?.category ?? "other") as Category;
        rows.push({
          date: (p.capturedAt ?? p.createdAt).toISOString().slice(0, 10),
          giver: p.payerName?.split(" ")[0] ?? "A giver",
          need: need?.title ?? "Savings",
          paidTo: p.payeeName,
          route: ROUTE_LABEL[p.route as Delivery] ?? p.route,
          delivery: p.route as Delivery,
          whatFor: CATEGORY_LABEL[category],
          category,
          amount: Number(p.amount),
          source: "Paid on this site",
        });
      }
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const sampleGifts = sample.gifts as Sample[];
  const gifts = rows.map((r, i) => ({ id: `g${i}`, date: r.date, amount: r.amount, delivery: r.delivery, category: r.category, giver: r.giver, recurring: sampleGifts.find((s) => s.date === r.date && s.giver === r.giver)?.recurring ?? false }));
  return { gifts: rows, months: monthsFor(gifts) };
}
