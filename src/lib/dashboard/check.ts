import { CATEGORY_CODE, ROUTE_CODE } from "./labels";
import { DEFAULT_PROFILE, checkMonthName, fbr, planMonths, type Category, type Delivery, type Gift } from "@/lib/rules";

/**
 * The figures the dashboard's check widget shows, every one from the rules engine. Pure, so a test can run the same
 * computation the widget runs on the rows AG Studio hands it. Client-safe.
 */
export type CheckFigures = {
  /** Her lowest check in view with the gifts as they were delivered. */
  lowestRouted: number;
  /** Her lowest check in view had every gift been cash, and the month that check is paid. */
  lowestCash: number;
  lowestCashMonth: string;
  /** Dollars kept in her checks across the months in view: routed minus cash, month by month. */
  kept: number;
  months: number;
  /** Every check in view is that year's full federal amount ($994 for a 2026 check, $1,029 for a 2027 one). */
  whole: boolean;
  years: string[];
};

/** The column keys of one data row as AG Studio returns it, one per mapped field. */
export type RowKeys = { date: string; giver: string; route: string; whatFor: string; amount: string };

const toDate = (v: unknown) => {
  const d = v instanceof Date ? v : new Date(typeof v === "number" ? v : String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/**
 * Rows from the dashboard's "gifts" table back into gifts for the rules engine. The table shows labels ("Paid to the
 * shop", "Medical"); the reverse maps in labels.ts turn them back into codes. A row whose label no longer maps, whose
 * date does not parse or whose amount is not positive is left out rather than guessed at.
 */
export function giftsFromRows(rows: Record<string, unknown>[], keys: RowKeys): Gift[] {
  const gifts: Gift[] = [];
  rows.forEach((row, i) => {
    const d = toDate(row[keys.date]);
    const delivery = ROUTE_CODE[String(row[keys.route])] as Delivery | undefined;
    const category = CATEGORY_CODE[String(row[keys.whatFor])] as Category | undefined;
    const value = Number(row[keys.amount]);
    if (d && delivery && category && value > 0) gifts.push({ id: `w${i}`, date: d, amount: value, delivery, category, giver: String(row[keys.giver] ?? "") });
  });
  return gifts;
}

/** Runs the rules engine twice, as delivered and as if every gift were cash, and compares month by month. */
export function checkFigures(gifts: Gift[]): CheckFigures | null {
  if (gifts.length === 0) return null;
  const routed = planMonths(gifts, DEFAULT_PROFILE).months;
  const cash = planMonths(gifts.map((g) => ({ ...g, delivery: "cash" as const })), DEFAULT_PROFILE).months;
  const worst = cash.reduce((a, b) => (b.check < a.check ? b : a));
  return {
    lowestRouted: Math.min(...routed.map((m) => m.check)),
    lowestCash: worst.check,
    lowestCashMonth: checkMonthName(worst.paymentMonth),
    kept: Math.round(routed.reduce((s, m, i) => s + (m.check - cash[i].check), 0) * 100) / 100,
    months: routed.length,
    whole: routed.every((m) => m.check >= fbr(false, m.paymentMonth)),
    years: [...new Set(routed.map((m) => m.paymentMonth.slice(0, 4)))],
  };
}
