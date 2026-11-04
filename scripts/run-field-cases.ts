// Real SSI cases from federal court opinions (content/eval/field-cases.json). Giftwise did not write them.
// For each scored case:
//   (a) does the rules engine agree with what SSA and the court held (counts or not, which rule, and the counted
//       amount within $1 where the opinion states one that does not depend on the year's rates);
//   (b) the check at 2026 rates with the help given as it actually was, against the same help routed through
//       Giftwise (to the landlord or provider, or to an ABLE account where the person is ABLE-eligible), using the
//       engine's own best route.
// Writes content/eval/field-cases-results.json. Engine only, no API calls.
// Usage: npx tsx --env-file=.env.local scripts/run-field-cases.ts
import { writeFileSync } from "node:fs";
import data from "../content/eval/field-cases.json";
import { DEFAULT_PROFILE, P, RULES_VERSION, SHELTER_CATEGORIES, planMonths, type Delivery, type Gift, type Profile } from "../src/lib/rules";

type Basis = "ism_vtr" | "ism_pmv" | "ism" | "unearned_cash" | "resources" | "income";
type Value = { month: string; measure: "after_infrequent"; value: number };
type FieldGift = Omit<Gift, "amount"> & { amount: number | null; amount_basis?: string; date_basis?: string };
type Overpayment = { amount: number; period: string } | null;
type Source = { court: string; citation: string; url: string; date: string };
type Scored = {
  id: string;
  status: "scored";
  title: string;
  source: Source;
  profile: Partial<Profile>;
  gifts: FieldGift[];
  giftwise_routes: Record<string, Delivery[]>;
  months: Record<string, number>;
  dollars: boolean;
  dollars_note?: string;
  determination: { by: string; court_outcome: string; counts: boolean; basis: Basis; values: Value[]; overpayment: Overpayment; held: string };
};
type NotScored = {
  id: string;
  status: "not_scored";
  not_scored_reason: string;
  title: string;
  source: Source;
  determination: { court_outcome: string; counts: boolean | null; overpayment?: Overpayment; held: string };
};

const CASES = data.cases as unknown as (Scored | NotScored)[];
const SCORED = CASES.filter((c): c is Scored => c.status === "scored");
const NOT_SCORED = CASES.filter((c): c is NotScored => c.status === "not_scored");
const TOLERANCE = 1;
const OUT = "content/eval/field-cases-results.json";
const SPECIFIC: Basis[] = ["ism_vtr", "ism_pmv", "unearned_cash", "resources"];

const round2 = (n: number) => Math.round(n * 100) / 100;
type PlanMonth = ReturnType<typeof planMonths>["months"][number];
/** Income from the help in a month after the infrequent exclusion, before the $20 general exclusion (as in run-ssa-examples.ts). */
const afterInfrequent = (m: PlanMonth) => round2(m.cashIncome + m.inKindIncome + m.ismValue - m.infrequentExcluded);

/** Where the opinion gives no amount for shelter, use SSA's presumed maximum value (20 CFR 416.1140). */
function toGift(g: FieldGift): Gift {
  if (g.amount === null && !SHELTER_CATEGORIES.includes(g.category)) throw new Error(`${g.id}: no amount and not shelter`);
  return { id: g.id, date: g.date, amount: g.amount ?? P.pmvIndividual, delivery: g.delivery, category: g.category, giver: g.giver, recurring: g.recurring, label: g.label };
}

function profileOf(c: Scored, overrides: Partial<Profile> = {}): Profile {
  return { ...DEFAULT_PROFILE, ableEligible: false, savings: 0, ...c.profile, ...overrides };
}

/** (a) What the engine says about the help as it was given. */
function engine(c: Scored) {
  const profile = profileOf(c);
  const plan = planMonths(c.gifts.map(toGift), profile);
  const bases = new Set<string>();
  for (const g of plan.gifts) if (g.treatment.kind === "unearned_cash") bases.add("unearned_cash");
  for (const m of plan.months) {
    if (m.vtrApplied) bases.add("ism_vtr");
    if (m.ismValue > 0) bases.add("ism_pmv");
    if (m.overResourceLimit) bases.add("resources");
  }
  const counts = plan.months.some((m) => afterInfrequent(m) > 0 || m.vtrApplied || m.overResourceLimit);
  const values = c.determination.values.map((v) => {
    const m = plan.months.find((x) => x.month === v.month);
    return { ...v, got: m ? afterInfrequent(m) : 0 };
  });
  const expected = c.determination.basis;
  const basisOk = expected === "ism" ? bases.has("ism_vtr") || bases.has("ism_pmv") : expected === "income" ? counts : bases.has(expected);
  const countsOk = counts === c.determination.counts;
  const valuesOk = values.every((v) => Math.abs(v.got - v.value) <= TOLERANCE);
  return {
    counts,
    rules_applied: [...bases],
    values,
    rule_ids: [...new Set(plan.gifts.flatMap((g) => g.ruleIds))],
    counts_match: countsOk,
    basis_match: basisOk,
    values_match: valuesOk,
    match: countsOk && basisOk && valuesOk,
    months: plan.months.map((m) => ({
      month: m.month,
      check_2026: m.check,
      countable_income: m.countableIncome,
      ism_value: m.ismValue,
      one_third_reduction: m.vtrApplied,
      savings_next_first: m.savingsOnNextFirst,
      over_resource_limit: m.overResourceLimit,
    })),
  };
}

/** Every way to deliver the gifts using the as-given delivery or one of the allowed Giftwise routes. */
function combinations(gifts: Gift[], allowed: (g: Gift) => Delivery[]): Delivery[][] {
  return gifts.reduce<Delivery[][]>(
    (acc, g) => {
      const options = [...new Set([g.delivery, ...allowed(g)])];
      return acc.flatMap((combo) => options.map((d) => [...combo, d]));
    },
    [[]],
  );
}

/** (b) The check at 2026 rates as given, and with the engine's best Giftwise route. */
function routing(c: Scored, profile: Profile, allowAble: boolean) {
  const gifts = c.gifts.map(toGift);
  const allowed = (g: Gift) => (c.giftwise_routes[g.id] ?? []).filter((d) => d !== "able" || allowAble);
  const asGiven = planMonths(gifts, profile);
  const total = (plan: ReturnType<typeof planMonths>) => plan.months.reduce((s, m) => s + m.check, 0);
  let best = { plan: asGiven, deliveries: gifts.map((g) => g.delivery) };
  for (const combo of combinations(gifts, allowed)) {
    const plan = planMonths(
      gifts.map((g, i) => ({ ...g, delivery: combo[i] })),
      profile,
    );
    if (total(plan) > total(best.plan) + 0.005) best = { plan, deliveries: combo };
  }
  const weight = (month: string) => {
    const ws = gifts.filter((g) => g.date.slice(0, 7) === month).map((g) => c.months[g.id]);
    return ws.every((w) => typeof w === "number") && ws.length > 0 ? Math.max(...(ws as number[])) : null;
  };
  const months = asGiven.months.map((m) => {
    const r = best.plan.months.find((x) => x.month === m.month)!;
    return { month: m.month, as_given_2026: m.check, routed_2026: r.check, kept: round2(r.check - m.check), months_stated: weight(m.month) };
  });
  const stated = months.every((m) => m.months_stated !== null);
  const weightSum = months.reduce((s, m) => s + (m.months_stated ?? 1), 0);
  return {
    routes: gifts.map((g, i) => ({ gift: g.id, label: g.label, as_given: g.delivery, giftwise: best.deliveries[i] })),
    months,
    kept_per_month: round2(months.reduce((s, m) => s + m.kept * (m.months_stated ?? 1), 0) / weightSum),
    months_stated: stated ? months.reduce((s, m) => s + (m.months_stated ?? 0), 0) : null,
    kept_over_stated_months: stated ? round2(months.reduce((s, m) => s + m.kept * (m.months_stated ?? 0), 0)) : null,
  };
}

function dollars(c: Scored) {
  if (!c.dollars) return { computed: false as const, note: c.dollars_note ?? null };
  const profile = profileOf(c);
  const shown = routing(c, profile, profile.ableEligible);
  const ifAble = profile.ableEligible ? null : routing(c, profileOf(c, { ableEligible: true }), true);
  return { computed: true as const, able_eligible_per_opinion: profile.ableEligible, ...shown, if_able_eligible: ifAble };
}

/** What the engine would need, for each known miss. */
const GAPS: Record<string, string> = {
  "sons-home-own-food":
    "Apply the one-third reduction only when the household also provides all of the person's meals (20 CFR 416.1131(a)(3)); otherwise value the shelter under the presumed value rule (20 CFR 416.1140). The engine applies the one-third reduction to anyone living in another person's household. The check comes out the same here ($662.67 at 2026 rates), but the rule cited and any rebuttal of the value differ.",
};

const describe = (e: ReturnType<typeof engine>) =>
  `${e.counts ? "counts" : "does not count"}; rules applied: ${e.rules_applied.join(", ") || "none"}` +
  (e.values.length ? `; amounts ${e.values.map((v) => `${v.month} ${v.got} (stated ${v.value})`).join(", ")}` : "");

function main() {
  const started = Date.now();
  const rows = SCORED.map((c) => {
    const e = engine(c);
    const d = dollars(c);
    const kept = d.computed ? `kept ${d.kept_per_month}/mo` : "dollars n/a";
    console.log(`${c.id.padEnd(30)} engine ${e.match ? "match " : "DIFFER"}  ${kept}`);
    return {
      id: c.id,
      title: c.title,
      citation: c.source.citation,
      url: c.source.url,
      determination: c.determination,
      engine: e,
      dollars: d,
    };
  });

  const withDollars = rows.filter((r) => r.dollars.computed);
  const sum = (xs: (number | null | undefined)[]) => round2(xs.reduce<number>((s, x) => s + (x ?? 0), 0));
  const shownKept = withDollars.map((r) => (r.dollars.computed ? r.dollars : null)!);
  const ableKept = shownKept.map((d) => d.if_able_eligible ?? d);
  const overpay = (cs: { id: string; determination: { overpayment?: Overpayment } }[]) =>
    cs.filter((c) => c.determination.overpayment).map((c) => ({ id: c.id, amount: c.determination.overpayment!.amount, period: c.determination.overpayment!.period }));
  const scoredOverpay = overpay(SCORED);
  const specific = rows.filter((r) => SPECIFIC.includes(r.determination.basis));

  const result = {
    ran_at: new Date().toISOString(),
    rules_version: RULES_VERSION,
    tolerance_usd: TOLERANCE,
    rates: `Engine amounts are 2026: federal benefit rate $${P.fbrIndividual}, presumed maximum value $${P.pmvIndividual}, one-third reduction $${P.vtrIndividual}. Dollar figures are what the same help would mean to a person on SSI in 2026.`,
    source: data.about.source,
    summary: {
      opinions_downloaded: data.about.opinions_downloaded,
      opinions_read_closely: data.about.opinions_read_closely,
      cases: CASES.length,
      scored: rows.length,
      not_scored: NOT_SCORED.length,
      agreed: rows.filter((r) => r.engine.match).length,
      agreed_on_whether_it_counts: rows.filter((r) => r.engine.counts_match).length,
      rule_named_in_opinion: specific.length,
      rule_agreed: specific.filter((r) => r.engine.basis_match).length,
      amounts_stated: rows.reduce((s, r) => s + r.engine.values.length, 0),
      amounts_agreed: rows.reduce((s, r) => s + r.engine.values.filter((v) => Math.abs(v.got - v.value) <= TOLERANCE).length, 0),
      dollars: {
        cases_computed: withDollars.length,
        cases_not_computed: rows.filter((r) => !r.dollars.computed).map((r) => r.id),
        as_shown_in_the_opinions: {
          note: "ABLE used only where the opinion shows the disability began before age 46; otherwise only paying the landlord or provider directly.",
          cases_where_routing_keeps_money: shownKept.filter((d) => d.kept_per_month > 0).length,
          kept_per_month_2026: sum(shownKept.map((d) => d.kept_per_month)),
          kept_over_stated_months_2026: sum(shownKept.map((d) => d.kept_over_stated_months)),
          cases_with_stated_months: shownKept.filter((d) => d.kept_over_stated_months !== null && d.kept_per_month > 0).length,
        },
        if_each_person_is_able_eligible: {
          note: "The same cases if each person qualifies for an ABLE account (disability before age 46, the rule from January 1, 2026).",
          cases_where_routing_keeps_money: ableKept.filter((d) => d.kept_per_month > 0).length,
          kept_per_month_2026: sum(ableKept.map((d) => d.kept_per_month)),
          kept_over_stated_months_2026: sum(ableKept.map((d) => d.kept_over_stated_months)),
        },
      },
      overpayments_stated: {
        note: "Overpayments SSA assessed, as stated in the opinions, in that year's dollars.",
        scored_total: sum(scoredOverpay.map((o) => o.amount)),
        scored: scoredOverpay,
      },
      misses: rows
        .filter((r) => !r.engine.match)
        .map((r) => ({ id: r.id, ssa_and_court_held: r.determination.held, engine_said: describe(r.engine), engine_needs: GAPS[r.id] ?? "See the engine output for this case." })),
      not_scored_cases: NOT_SCORED.map((c) => ({ id: c.id, reason: c.not_scored_reason })),
    },
    cases: rows,
    ms: Date.now() - started,
  };
  writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
  const s = result.summary;
  console.log(
    `\nscored ${s.scored} of ${s.cases}: engine agreed ${s.agreed}/${s.scored} (whether it counts ${s.agreed_on_whether_it_counts}/${s.scored}, rule ${s.rule_agreed}/${s.rule_named_in_opinion}, amounts ${s.amounts_agreed}/${s.amounts_stated})`,
  );
  console.log(
    `kept at 2026 rates: $${s.dollars.as_shown_in_the_opinions.kept_per_month_2026}/mo, $${s.dollars.as_shown_in_the_opinions.kept_over_stated_months_2026} over stated months; if ABLE-eligible $${s.dollars.if_each_person_is_able_eligible.kept_per_month_2026}/mo, $${s.dollars.if_each_person_is_able_eligible.kept_over_stated_months_2026}`,
  );
}

main();
