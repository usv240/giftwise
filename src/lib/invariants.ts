/**
 * Random gifts through the router, each answer held to the same promises. A seeded generator makes every run
 * repeatable: the same seed gives the same gifts, needs and people. Used by scripts/run-invariants.ts (the full run)
 * and tests/invariants.test.ts (a smaller sample on every test run).
 */
import { routeGift, MAX_UNITS, type OpenNeed, type RoutedGift } from "./routing";
import { P, RULES, addMonths, computeMonth, fbr, monthOf, type Category, type Profile } from "./rules";

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORIES: Category[] = ["medical", "equipment", "phone", "internet", "education", "utility", "rent", "mortgage", "property_tax", "food", "clothing", "transport", "personal", "event", "other"];

export type Case = { amount: number; needs: OpenNeed[]; date: string; profile: Profile };

export function makeCase(r: () => number): Case {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const cents = (max: number) => Math.round(r() * max * 100) / 100;
  const smallOrLarge = (max: number) => (r() < 0.4 ? cents(120) : cents(max));
  const needs: OpenNeed[] = Array.from({ length: Math.floor(r() * 13) }, (_, i) => {
    const amount = Math.max(0.01, smallOrLarge(3000));
    return {
      id: i + 1,
      title: `Need ${i + 1}`,
      category: pick(CATEGORIES),
      route: r() < 0.75 ? "vendor" : "able",
      payeeName: `Payee ${i + 1}`,
      payeeAccount: r() < 0.75 ? `shop-${i + 1}` : "able",
      amount,
      funded: r() < 0.3 ? cents(amount) : 0,
      recurring: r() < 0.3,
    };
  });
  const lives = r() < 0.35;
  const profile: Profile = {
    couple: r() < 0.15,
    livesInAnothersHousehold: lives,
    householdProvidesAllMeals: lives ? r() < 0.7 : undefined,
    otherUnearnedMonthly: r() < 0.6 ? 0 : cents(1200),
    earnedMonthly: r() < 0.7 ? 0 : cents(2000),
    ableEligible: r() < 0.85,
    ableBalance: cents(r() < 0.9 ? 30_000 : 120_000),
    ableContributedThisYear: r() < 0.6 ? 0 : cents(21_000),
    savings: cents(2_500),
  };
  const month = 1 + Math.floor(r() * 12);
  const day = 1 + Math.floor(r() * 28);
  const date = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { amount: Math.max(0.01, smallOrLarge(20_000)), needs, date, profile };
}

const c = (n: number) => Math.round(n * 100);
const RULE_IDS = new Set(Object.keys(RULES));

/** The promises, in the words /evidence shows. Each returns true when the answer keeps it. */
export const INVARIANTS: { id: string; promise: string; holds: (k: Case, g: RoutedGift) => boolean }[] = [
  {
    id: "to-the-cent",
    promise: "Every cent is either paid to a recipient or handed back, never lost or made up",
    holds: (k, g) => g.lines.reduce((a, l) => a + c(l.amount), 0) + c(g.unplaced) === c(k.amount),
  },
  {
    id: "check-whole",
    promise: "Her check is exactly what it would be with no gift at all",
    holds: (_k, g) => g.checkWithRouting === g.baseline,
  },
  {
    id: "beats-cash",
    promise: "Routed, her check is never lower than the same gift as cash",
    holds: (_k, g) => g.checkWithRouting >= g.checkIfCash,
  },
  {
    id: "need-cap",
    promise: "No recipient is paid more than the need still open",
    holds: (k, g) =>
      g.lines.every((l) => {
        if (l.needId === null) return true;
        const n = k.needs.find((x) => x.id === l.needId)!;
        return c(l.amount) <= c(n.amount) - c(n.funded);
      }),
  },
  {
    id: "able-limit",
    promise: "ABLE deposits stay within the $20,000 yearly limit",
    holds: (k, g) => {
      const able = g.lines.filter((l) => l.route === "able").reduce((a, l) => a + c(l.amount), 0);
      return able === 0 || c(k.profile.ableContributedThisYear) + able <= c(P.ableAnnualLimit);
    },
  },
  {
    id: "able-eligible",
    promise: "Money goes to an ABLE account only for someone who can have one",
    holds: (k, g) => k.profile.ableEligible || g.lines.every((l) => l.route !== "able"),
  },
  {
    id: "paypal-limit",
    promise: "One checkout never needs more than PayPal's 10 recipients",
    holds: (_k, g) => g.lines.length <= MAX_UNITS,
  },
  {
    id: "whole-cents",
    promise: "Every amount is positive and in whole cents",
    holds: (_k, g) => g.lines.every((l) => l.amount > 0 && Math.abs(l.amount * 100 - c(l.amount)) < 1e-6),
  },
  {
    id: "cites-a-rule",
    promise: "Every line cites a rule in Giftwise's rule table",
    holds: (_k, g) => g.lines.every((l) => l.ruleIds.length > 0 && l.ruleIds.every((id) => RULE_IDS.has(id))),
  },
  {
    id: "within-rate",
    promise: "No check is above the federal SSI rate or below zero",
    holds: (k, g) => [g.baseline, g.checkIfCash, g.checkWithRouting].every((x) => x >= 0 && x <= fbr(k.profile.couple, addMonths(monthOf(k.date), P.rmaLagMonths))),
  },
  {
    id: "recomputed",
    promise: "Recomputing the month from the lines gives the same check",
    holds: (k, g) =>
      computeMonth(
        monthOf(k.date),
        g.lines.map((l, i) => ({ id: `l${i}`, date: k.date, amount: l.amount, delivery: l.route, category: l.category, recurring: l.recurring })),
        k.profile,
      ).check === g.checkWithRouting,
  },
  {
    id: "same-answer",
    promise: "The same gift always gets the same answer",
    holds: (k, g) => JSON.stringify(routeGift(k.amount, k.needs, k.date, k.profile)) === JSON.stringify(g),
  },
];

export type InvariantRun = {
  seed: number;
  gifts: number;
  dollars: number;
  lines: number;
  results: { id: string; promise: string; kept: number; broken: number; firstBroken?: Case }[];
};

export function runInvariants(gifts: number, seed = 20261104): InvariantRun {
  const r = rng(seed);
  const tally = INVARIANTS.map((v) => ({ id: v.id, promise: v.promise, kept: 0, broken: 0, firstBroken: undefined as Case | undefined }));
  let dollars = 0;
  let lines = 0;
  for (let i = 0; i < gifts; i++) {
    const k = makeCase(r);
    const g = routeGift(k.amount, k.needs, k.date, k.profile);
    dollars += c(k.amount);
    lines += g.lines.length;
    INVARIANTS.forEach((v, j) => {
      if (v.holds(k, g)) tally[j].kept++;
      else {
        tally[j].broken++;
        tally[j].firstBroken ??= k;
      }
    });
  }
  return { seed, gifts, dollars: dollars / 100, lines, results: tally };
}
