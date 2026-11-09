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
    plain: "Cash or a check given to the person counts as income in the month it arrives, after small exclusions.",
    sourceKeys: ["cfr-416-1121", "poms-si-00830-520", "poms-si-00810-410", "poms-si-00810-420"],
  },
  "R-INFREQ-01": {
    id: "R-INFREQ-01",
    name: "Infrequent or irregular income exclusion",
    plain: "The first $60 a quarter of one-off unearned income is not counted. It applies in the order income arrives, and to housing help before the monthly cap.",
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
  "R-SHEL-02": {
    id: "R-SHEL-02",
    name: "Housing bills paid ahead",
    plain: "When someone pays a housing bill that covers later months, the share for each later month counts in that month; the share for months up to the payment counts when it is paid.",
    sourceKeys: ["poms-si-00835-360"],
  },
  "R-SHEL-03": {
    id: "R-SHEL-03",
    name: "Housing given as itself",
    plain: "A home, or other shelter, given to the person as itself counts as in-kind support in the month it is received, up to the monthly cap. A home given outright that the person lives in counts only in that month.",
    sourceKeys: ["poms-si-00835-400", "poms-si-00835-310", "poms-si-00815-550", "poms-si-00835-300", "poms-si-00835-901"],
  },
  "R-SHEL-04": {
    id: "R-SHEL-04",
    name: "Housing bills paid by a co-owner",
    plain: "When a co-owner of the home pays its bills, the payment is not a gift: the share for each month it covers counts in that month, past months included, each up to the monthly cap.",
    sourceKeys: ["poms-si-00835-360", "poms-si-00835-310"],
  },
  "R-SHEL-05": {
    id: "R-SHEL-05",
    name: "Rent below market from a parent or child",
    plain: "When the landlord is the person's parent or child and charges less than market rent, the subsidy counted each month is the lesser of the market rent and the monthly cap, less the rent paid. Rent at or above the cap is a business arrangement, and nothing is counted.",
    sourceKeys: ["poms-si-00835-380", "fr-89-25507-rental-subsidy", "poms-si-00835-300"],
  },
  "R-SHEL-06": {
    id: "R-SHEL-06",
    name: "Housing bills paid by the week",
    plain: "Rent or another housing bill paid weekly is converted to a monthly amount: the weekly amount times 13, divided by 3. A bill paid every two weeks is halved first. The month counts the converted amount, however many payment days fall in it, up to the monthly cap.",
    sourceKeys: ["poms-si-00835-474", "poms-si-00835-350"],
  },
  "R-SHEL-07": {
    id: "R-SHEL-07",
    name: "Housing help shared by the household",
    plain: "Housing paid from outside the household for the whole household, such as its rent or property tax, is divided equally among the people who live there, and she is charged her share, up to the monthly cap. For a couple, one member's share times two. A rental subsidy is divided the same way.",
    sourceKeys: ["poms-si-00835-350", "poms-si-00835-474", "poms-si-00835-380"],
  },
  "R-SHEL-VTR": {
    id: "R-SHEL-VTR",
    name: "Living in another person's household",
    plain: "When the person lives in someone else's home all month, gets shelter there without paying a share, and the household provides all meals, the check is reduced by a fixed one third every month, gift or not, and no other housing help counts on top of it.",
    sourceKeys: ["cfr-416-1131", "poms-si-00835-200", "poms-si-00835-901"],
  },
  "R-SHEL-08": {
    id: "R-SHEL-08",
    name: "Paying a share of another person's household",
    plain: "Living in someone else's household, the person's pro rata share is its monthly housing costs divided by the people who live there. Paying that share, or within $20 of it, she gets no support from the household. Paying less, the one-third reduction applies every month if the household provides all her meals; otherwise the shelter it gives her counts up to the monthly cap, valued at her share less what she pays. Food is not part of the costs since 2024, so money she pays for food does not count toward the share.",
    sourceKeys: ["cfr-416-1133", "cfr-416-1131", "poms-si-00835-160", "poms-si-00835-170", "poms-si-00835-340", "poms-si-00835-450", "fr-89-21199"],
  },
  "R-LOAN-01": {
    id: "R-LOAN-01",
    name: "Cash lent, not given",
    plain: "Cash lent to the person is not income when it is a bona fide loan: she must repay it whatever happens with her benefits, both sides agreed to that when it was given, and she has a plan to repay that she can meet. Cash she still has the next month counts toward savings. If any of that is missing, it counts as a gift. Paying a loan back does not lower countable income.",
    sourceKeys: ["cfr-416-1103-f", "poms-si-01120-220"],
  },
  "R-LOAN-02": {
    id: "R-LOAN-02",
    name: "Food or shelter lent, not given",
    plain: "Housing someone pays for as a bona fide loan counts only for the part the person is not required to repay, valued as if there were no loan. When the household she lives in lends her its shelter, the amount borrowed counts as what she pays toward her share of its costs. A loan that fails any of SSA's tests counts like any other help.",
    sourceKeys: ["poms-si-00835-482", "cfr-416-1103-f"],
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
    plain: "A gift of an item for personal or household use, such as a laptop or a chair, is not counted as income.",
    sourceKeys: ["cfr-416-1103-g", "poms-si-01130-430"],
  },
  "R-ITEM-02": {
    id: "R-ITEM-02",
    name: "Tickets and other things that are not for personal use",
    plain: "Tickets to a game, show or event that she receives count as income at their value, even when someone buys them straight from the box office.",
    sourceKeys: ["poms-si-00830-520", "poms-si-00810-410"],
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
    plain: "Money others put into the person's ABLE account is not income, and the first $100,000 in it does not count toward savings.",
    sourceKeys: ["poms-si-01130-740", "ssa-spotlight-able-2026"],
  },
  "R-ABLE-02": {
    id: "R-ABLE-02",
    name: "ABLE withdrawals for housing",
    plain: "Money taken from an ABLE account for housing is not income when it is spent in the same month it is taken out.",
    sourceKeys: ["poms-si-01130-740"],
  },
  "R-ABLE-03": {
    id: "R-ABLE-03",
    name: "An ABLE balance over $100,000",
    plain: "The part of an ABLE account over $100,000 counts toward savings. When that puts her over the savings limit, SSI cash stops while it stays over and Medicaid continues; when her other savings alone are over the limit, no SSI is paid that month.",
    sourceKeys: ["poms-si-01130-740", "poms-si-01110-003"],
  },
  "R-RES-01": {
    id: "R-RES-01",
    name: "Savings limit on the first of the month",
    plain: "Countable savings must be $2,000 or less at the start of each month ($3,000 for a couple). Over the limit on the 1st, no SSI is paid for that month.",
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
