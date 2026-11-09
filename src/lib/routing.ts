import { DEFAULT_PROFILE, P, computeMonth, evaluateGift, monthOf, type Category, type Delivery, type Gift, type Profile } from "./rules";

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
  /** The need comes back every month, so it never takes the one-off exclusion. */
  recurring?: boolean;
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
  /**
   * When money is handed back because her ABLE account has no room: "year" for the $20,000 yearly limit, "balance" when
   * a deposit would take the account past $100,000, where it would count toward her savings (R-ABLE-03). Otherwise null.
   */
  ableFull?: "year" | "balance" | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
export const MAX_UNITS = 10;

/**
 * The payees a set of lines pays, each once, in the order they first appear. One order can pay the same payee on two
 * lines (her ABLE account for a bill and for savings); every count of recipients shown to a person counts payees.
 */
export function distinctPayees<T extends { payeeName: string }>(lines: T[]): string[] {
  return [...new Set(lines.map((l) => l.payeeName))];
}

/** Lines merged by payee for display: each payee once, with what it is paid for and the total, in first-seen order. */
export function byPayee<T extends { payeeName: string; amount: number }>(lines: T[]): { payeeName: string; lines: T[]; amount: number }[] {
  const out = new Map<string, { payeeName: string; lines: T[]; amount: number }>();
  for (const l of lines) {
    const g = out.get(l.payeeName) ?? { payeeName: l.payeeName, lines: [], amount: 0 };
    g.lines.push(l);
    g.amount = round2(g.amount + l.amount);
    out.set(l.payeeName, g);
  }
  return [...out.values()];
}

/**
 * Route one gift of any amount, benefit-safe: fill the open needs in order (paid straight to each shop),
 * then send what is left to the person's ABLE account, up to the year's limit and up to $100,000 in the account. The
 * rules engine checks every line.
 */
export function routeGift(amount: number, needs: OpenNeed[], date: string, profile: Profile = DEFAULT_PROFILE, ableName = "Maya's ABLE account"): RoutedGift {
  let left = round2(Math.max(0, amount));
  const lines: RoutedLine[] = [];
  const month = monthOf(date);
  const base = computeMonth(month, [], profile);
  const baseline = base.check;
  // Each line is checked together with the lines already chosen, so small amounts cannot add up past the exclusions. The
  // check her income alone gives must hold too, so a month already over the savings limit is routed the same way.
  const asGift = (l: Pick<RoutedLine, "amount" | "route" | "category" | "recurring">, i: number): Gift => ({ id: `l${i}`, date, amount: l.amount, delivery: l.route, category: l.category, recurring: l.recurring });
  const keepsCheck = (extra: Pick<RoutedLine, "amount" | "route" | "category" | "recurring">) => {
    const t = computeMonth(month, [...lines, extra].map(asGift), profile);
    return t.check === baseline && t.incomeCheck === base.incomeCheck;
  };
  // ABLE deposits from this gift count toward the year's limit together (26 U.S.C. 529A(b)(2)(B)), and stop at $100,000
  // in the account: past that a deposit counts toward her savings (R-ABLE-03, POMS SI 01130.740 D.1).
  const ableSoFar = () => lines.filter((l) => l.route === "able").reduce((a, l) => a + l.amount, 0);
  const yearRoom = () => round2(P.ableAnnualLimit - profile.ableContributedThisYear - ableSoFar());
  const balanceRoom = () => round2(P.ableResourceExclusion - (profile.ableBalance ?? 0) - ableSoFar());
  const ableRoom = () => Math.max(0, Math.min(yearRoom(), balanceRoom()));
  let ableFull: RoutedGift["ableFull"] = null;
  const noteFull = (wanted: number) => {
    if (wanted > ableRoom() && ableFull === null) ableFull = yearRoom() <= balanceRoom() ? "year" : "balance";
  };
  for (const n of needs) {
    if (left <= 0 || lines.length >= MAX_UNITS - 1) break;
    const remaining = round2(n.amount - n.funded);
    if (remaining <= 0) continue;
    const route = n.route as Delivery;
    const category = n.category as Category;
    if (route === "able" && !profile.ableEligible) continue;
    if (route === "able") noteFull(Math.min(left, remaining));
    const take = round2(Math.min(left, remaining, route === "able" ? ableRoom() : Infinity));
    if (take <= 0) continue;
    const r = evaluateGift({ id: `n${n.id}`, date, amount: take, delivery: route, category, recurring: n.recurring }, profile);
    if (r.treatment.kind === "not_possible") continue;
    if (!keepsCheck({ amount: take, route, category, recurring: n.recurring })) continue; // never route money in a way that lowers the check
    lines.push({
      referenceId: `need-${n.id}`,
      needId: n.id,
      title: n.title,
      payeeName: n.payeeName,
      payeeAccount: n.payeeAccount,
      route,
      category,
      recurring: n.recurring,
      amount: take,
      ruleIds: r.ruleIds,
      plain: r.explanation.plain,
    });
    left = round2(left - take);
  }
  // What is left goes to the ABLE account, up to its room; anything past that is handed back, never counted.
  if (profile.ableEligible && left > 0) noteFull(left);
  const toAble = profile.ableEligible ? round2(Math.min(left, ableRoom())) : 0;
  if (toAble > 0) {
    const r = evaluateGift({ id: "able", date, amount: toAble, delivery: "able", category: "other" }, profile);
    lines.push({
      referenceId: "able-savings",
      needId: null,
      title: "savings for later",
      payeeName: ableName,
      payeeAccount: "able",
      route: "able",
      category: "other",
      amount: toAble,
      ruleIds: r.ruleIds,
      plain: r.explanation.plain,
    });
    left = round2(left - toAble);
  }
  const cash = evaluateGift({ id: "cash", date, amount, delivery: "cash", category: "other" }, profile);
  const routed = computeMonth(month, lines.map(asGift), profile);
  return { amount: round2(amount), lines, unplaced: round2(left), checkIfCash: cash.checkAfter, checkWithRouting: routed.check, baseline, ableFull: round2(left) > 0 ? ableFull : null };
}
