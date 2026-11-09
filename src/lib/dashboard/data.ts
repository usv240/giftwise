import { giftSubject } from "@/lib/report/data";
import type { ReportGift } from "@/lib/report/ssa";
import { CATEGORY_LABEL, ROUTE_LABEL } from "./labels";
import { DEFAULT_PROFILE, monthOf, planMonths, type Category, type Delivery, type Gift, type Profile } from "@/lib/rules";

/** One gift, as the dashboard's "gifts" table sees it. Labels are what people read; delivery and category stay as codes for the rules engine. */
export type GiftRow = { date: string; giver: string; need: string; paidTo: string; route: string; delivery: Delivery; whatFor: string; category: Category; amount: number; source: string };
export type MonthRow = { month: string; given: number; checkWithGiftwise: number; checkIfCash: number; kept: number };


/** Her check for each income month, given the gifts as they were delivered, and if every one had been cash instead. */
export function monthsFor(gifts: (Gift & { recurring?: boolean })[], profile: Profile = DEFAULT_PROFILE): MonthRow[] {
  const routed = planMonths(gifts, profile).months;
  const cash = planMonths(gifts.map((g) => ({ ...g, delivery: "cash" as const })), profile).months;
  return routed.map((m, i) => {
    const given = gifts.filter((g) => monthOf(g.date) === m.month).reduce((s, g) => s + g.amount, 0);
    return { month: `${m.month}-01`, given, checkWithGiftwise: m.check, checkIfCash: cash[i].check, kept: Math.round((m.check - cash[i].check) * 100) / 100 };
  });
}

/**
 * The dashboard's kept figure and its baseline, in one place: what Giftwise kept in her checks against the same gifts
 * given as cash, summed over the months shown. The home page's sample-year figure has a different baseline (six givers
 * each paying the shop on their own, src/lib/impact.ts payItYourself), and each page names its own beside the number.
 */
export const KEPT_VS_CASH = "against the same gifts given as cash";
export function keptAgainstCash(months: MonthRow[]) {
  return Math.round(months.reduce((s, m) => s + m.kept, 0) * 100) / 100;
}
export function keptSentence(months: MonthRow[], usd: (n: number) => string) {
  return `Giftwise kept ${usd(keptAgainstCash(months))} in her checks over ${months.length} ${months.length === 1 ? "month" : "months"}, ${KEPT_VS_CASH}.`;
}

const SOURCE: Record<ReportGift["evidence"]["kind"], string> = { sample: "Sample year", paypal_capture: "Paid on this site", paypal_payout: "Fund payout on this site" };

/** The sample year plus every gift actually paid on this site for the sample household. Same loader as the SSA report. */
export async function dashboardData() {
  const subject = await giftSubject("maya");
  const all = subject?.gifts ?? [];
  const rows: GiftRow[] = all.map((g) => ({
    date: g.date,
    giver: g.giver,
    need: g.need,
    paidTo: g.paidTo,
    route: ROUTE_LABEL[g.delivery] ?? g.delivery,
    delivery: g.delivery,
    whatFor: CATEGORY_LABEL[g.category],
    category: g.category,
    amount: g.amount,
    source: SOURCE[g.evidence.kind],
  }));
  const gifts = all.map((g) => ({ id: g.id, date: g.date, amount: g.amount, delivery: g.delivery, category: g.category, giver: g.giver, recurring: g.recurring ?? false }));
  return { gifts: rows, months: monthsFor(gifts) };
}
