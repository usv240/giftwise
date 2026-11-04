import facts from "../../../content/facts.json";

type FactValues = typeof facts.values;

function num(key: keyof FactValues): number {
  const v = facts.values[key].value;
  if (typeof v !== "number") throw new Error(`Fact ${String(key)} is not a number`);
  return v;
}

export const RULES_VERSION = facts.rulesVersion;

export const P = {
  fbrIndividual: num("fbr_individual"),
  fbrCouple: num("fbr_couple"),
  resourceLimitIndividual: num("resource_limit_individual"),
  resourceLimitCouple: num("resource_limit_couple"),
  generalIncomeExclusion: num("general_income_exclusion"),
  infrequentUnearnedPerQuarter: num("infrequent_unearned_per_quarter"),
  infrequentEarnedPerQuarter: num("infrequent_earned_per_quarter"),
  earnedIncomeExclusion: num("earned_income_exclusion"),
  pmvIndividual: num("pmv_individual"),
  pmvCouple: num("pmv_couple"),
  vtrIndividual: num("vtr_individual"),
  vtrCouple: num("vtr_couple"),
  ableAnnualLimit: num("able_annual_limit"),
  ableResourceExclusion: num("able_resource_exclusion"),
  ableOnsetAge: num("able_onset_age"),
  rmaLagMonths: num("rma_lag_months"),
  ismFoodRemovedOn: String(facts.values.ism_food_removed_on.value),
} as const;

/**
 * The federal amounts by the year of the check. Under retrospective accounting the check paid in a month uses that
 * month's federal benefit rate, and after a cost-of-living increase the one-third reduction and the presumed maximum
 * value follow the new rate too (POMS SI 02005.001 E.4.c). So November and December income set January and February
 * checks at the new year's amounts. Years before the first listed use the first; later years use the latest.
 */
const RATES: Record<number, { fbr: [number, number]; pmv: [number, number]; vtr: [number, number] }> = {
  2026: { fbr: [P.fbrIndividual, P.fbrCouple], pmv: [P.pmvIndividual, P.pmvCouple], vtr: [P.vtrIndividual, P.vtrCouple] },
  2027: {
    fbr: [num("fbr_individual_2027"), num("fbr_couple_2027")],
    pmv: [num("pmv_individual_2027"), num("pmv_couple_2027")],
    vtr: [num("vtr_individual_2027"), num("vtr_couple_2027")],
  },
};
export const RATE_YEARS = Object.keys(RATES).map(Number).sort();

/** The amounts for the check paid in `payMonth` (YYYY-MM); with no month, the first listed year's. */
export function ratesFor(payMonth?: string) {
  const y = payMonth ? Number(payMonth.slice(0, 4)) : RATE_YEARS[0];
  const earlier = RATE_YEARS.filter((x) => x <= y);
  const year = earlier.length ? earlier[earlier.length - 1] : RATE_YEARS[0];
  return { year, ...RATES[year] };
}

export function fbr(couple: boolean, payMonth?: string) {
  return ratesFor(payMonth).fbr[couple ? 1 : 0];
}
export function pmv(couple: boolean, payMonth?: string) {
  return ratesFor(payMonth).pmv[couple ? 1 : 0];
}
export function vtr(couple: boolean, payMonth?: string) {
  return ratesFor(payMonth).vtr[couple ? 1 : 0];
}
export function resourceLimit(couple: boolean) {
  return couple ? P.resourceLimitCouple : P.resourceLimitIndividual;
}
