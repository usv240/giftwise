export interface RuleRow {
  id: string;
  name: string;
  plain: string;
  sourceKeys: string[];
}

/** Every rule the engine can apply. Each row has a unit test in tests/rules.test.ts. */
export const RULES: Record<string, RuleRow> = {
  "R-CASH-01": {
    id: "R-CASH-01",
    name: "Cash gifts are unearned income",
    plain: "Cash or a check given to her counts as income in the month it arrives, after small exclusions.",
    sourceKeys: ["cfr-416-1121", "poms-si-00830-520", "poms-si-00810-410", "poms-si-00810-420"],
  },
  "R-INFREQ-01": {
    id: "R-INFREQ-01",
    name: "Infrequent or irregular income exclusion",
    plain: "The first $60 a quarter of one-off unearned income is not counted.",
    sourceKeys: ["poms-si-00810-410"],
  },
  "R-GIE-01": {
    id: "R-GIE-01",
    name: "General income exclusion",
    plain: "The first $20 of income each month is not counted.",
    sourceKeys: ["poms-si-00810-420"],
  },
  "R-VEND-01": {
    id: "R-VEND-01",
    name: "Bills paid directly to a supplier",
    plain: "When someone pays a shop directly for something other than housing, it is not income.",
    sourceKeys: ["cfr-416-1103-g", "poms-si-00815-400"],
  },
  "R-SHEL-01": {
    id: "R-SHEL-01",
    name: "Housing costs paid by others",
    plain: "Rent, mortgage, property tax and utilities paid by someone else count as in-kind support, up to a monthly cap.",
    sourceKeys: ["cfr-416-1130", "poms-si-00835-020", "poms-si-00835-350", "poms-si-00835-360", "poms-si-00835-901"],
  },
  "R-SHEL-VTR": {
    id: "R-SHEL-VTR",
    name: "Living in another person's household",
    plain: "When she lives in someone else's home all month without paying her share of housing, a fixed one-third reduction applies instead.",
    sourceKeys: ["poms-si-00835-200", "poms-si-00835-901"],
  },
  "R-FOOD-01": {
    id: "R-FOOD-01",
    name: "Food is no longer in-kind support",
    plain: "Since September 30, 2024, food paid for by others is not counted.",
    sourceKeys: ["fr-89-21199", "cfr-416-1130"],
  },
  "R-ITEM-01": {
    id: "R-ITEM-01",
    name: "Gift of an item for personal use",
    plain: "A gift of an item for her personal or household use, such as a laptop or a chair, is not counted as income.",
    sourceKeys: ["cfr-416-1103-g", "poms-si-01130-430"],
  },
  "R-EDU-01": {
    id: "R-EDU-01",
    name: "Gifts used for education",
    plain: "A gift used for tuition, fees, books, supplies or school technology is not counted.",
    sourceKeys: ["poms-si-00830-455"],
  },
  "R-ABLE-01": {
    id: "R-ABLE-01",
    name: "Contributions to an ABLE account",
    plain: "Money put into her ABLE account by others is not her income, and the first $100,000 in it does not count toward savings.",
    sourceKeys: ["poms-si-01130-740", "ssa-spotlight-able-2026"],
  },
  "R-ABLE-02": {
    id: "R-ABLE-02",
    name: "ABLE withdrawals for housing",
    plain: "Money she takes from her ABLE account for housing is not income when she spends it in the same month.",
    sourceKeys: ["poms-si-01130-740"],
  },
  "R-RES-01": {
    id: "R-RES-01",
    name: "Savings limit on the first of the month",
    plain: "Countable savings must be $2,000 or less at the start of each month ($3,000 for a couple).",
    sourceKeys: ["poms-si-01110-003", "poms-si-01110-600"],
  },
  "R-RMA-01": {
    id: "R-RMA-01",
    name: "Two-month delay",
    plain: "Income counted in one month changes the check two months later.",
    sourceKeys: ["poms-si-02005-001"],
  },
};

export function sourcesFor(ruleIds: string[]): string[] {
  const out = new Set<string>();
  for (const id of ruleIds) for (const s of RULES[id]?.sourceKeys ?? []) out.add(s);
  return [...out];
}
