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

export function fbr(couple: boolean) {
  return couple ? P.fbrCouple : P.fbrIndividual;
}
export function pmv(couple: boolean) {
  return couple ? P.pmvCouple : P.pmvIndividual;
}
export function vtr(couple: boolean) {
  return couple ? P.vtrCouple : P.vtrIndividual;
}
export function resourceLimit(couple: boolean) {
  return couple ? P.resourceLimitCouple : P.resourceLimitIndividual;
}
