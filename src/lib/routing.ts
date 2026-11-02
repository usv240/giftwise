import { DEFAULT_PROFILE, computeMonth, evaluateGift, monthOf, type Category, type Delivery, type Profile } from "./rules";

export type OpenNeed = {
  id: number;
  title: string;
  category: string;
  route: string;
  payeeName: string;
  payeeAccount: string;
  amount: number;
  funded: number;
  recurring: boolean;
};

export type RoutedLine = {
  referenceId: string;
  needId: number | null;
  title: string;
  payeeName: string;
  payeeAccount: string;
  route: Delivery;
  category: Category;
  amount: number;
  ruleIds: string[];
  plain: string;
};

export type RoutedGift = {
  amount: number;
  lines: RoutedLine[];
  unplaced: number;
  checkIfCash: number;
  checkWithRouting: number;
  baseline: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
export const MAX_UNITS = 10;

/**
 * Route one gift of any amount, benefit-safe: fill her open needs in order (paid straight to each shop),
 * then send what is left to her ABLE account. The rules engine checks every line.
 */
export function routeGift(amount: number, needs: OpenNeed[], date: string, profile: Profile = DEFAULT_PROFILE): RoutedGift {
  let left = round2(Math.max(0, amount));
  const lines: RoutedLine[] = [];
  for (const n of needs) {
    if (left <= 0 || lines.length >= MAX_UNITS - 1) break;
    const remaining = round2(n.amount - n.funded);
    if (remaining <= 0) continue;
    const take = round2(Math.min(left, remaining));
    const r = evaluateGift({ id: `n${n.id}`, date, amount: take, delivery: n.route as Delivery, category: n.category as Category, recurring: n.recurring }, profile);
    if (r.checkAfter < r.checkBaseline) continue; // never route money in a way that lowers the check
    lines.push({
      referenceId: `need-${n.id}`,
      needId: n.id,
      title: n.title,
      payeeName: n.payeeName,
      payeeAccount: n.payeeAccount,
      route: n.route as Delivery,
      category: n.category as Category,
      amount: take,
      ruleIds: r.ruleIds,
      plain: r.explanation.plain,
    });
    left = round2(left - take);
  }
  if (left > 0 && profile.ableEligible) {
    const r = evaluateGift({ id: "able", date, amount: left, delivery: "able", category: "other" }, profile);
    if (!r.ambiguous) {
      lines.push({
        referenceId: "able-savings",
        needId: null,
        title: "savings for later",
        payeeName: "Maya's ABLE account",
        payeeAccount: "able",
        route: "able",
        category: "other",
        amount: left,
        ruleIds: r.ruleIds,
        plain: r.explanation.plain,
      });
      left = 0;
    }
  }
  const month = monthOf(date);
  const cash = evaluateGift({ id: "cash", date, amount, delivery: "cash", category: "other" }, profile);
  const routed = computeMonth(
    month,
    lines.map((l, i) => ({ id: `l${i}`, date, amount: l.amount, delivery: l.route, category: l.category })),
    profile,
  );
  return { amount: round2(amount), lines, unplaced: round2(left), checkIfCash: cash.checkAfter, checkWithRouting: routed.check, baseline: cash.checkBaseline };
}
