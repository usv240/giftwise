import facts from "../../content/facts.json";
import sources from "../../content/sources.json";
import { IMPACT } from "./impact";

/**
 * The problem, measured by the agency itself: figures from SSA's statistics, its financial report, its Inspector
 * General and the Federal Register, each stated as what it measures, with the page date, and beside each the code in
 * Giftwise that answers it. Every figure here was read from the source named (the agency pages in a browser, the PDFs
 * as extracted text); tests/research.test.ts holds each source to a url, publisher and date and each code path to a file.
 */
type Source = { title: string; url: string; publisher: string; date?: string };
const SRC = sources as Record<string, Source>;

export type Figure = {
  id: string;
  /** The number, as the source states it. */
  figure: string;
  /** What that number measures, in the source's own terms. */
  measures: string;
  /** What in Giftwise answers it, naming the code. */
  inGiftwise: string;
  code: string[];
  source: string;
  sourceLabel: string;
};

const fbr = facts.values.fbr_individual.value;
/** SSI overpayments are recovered at 10 percent of the monthly check (EM-25029 REV): the months a stated overpayment takes to repay. */
export const RECOVERY_RATE = 0.1;
export const repayMonths = (amount: number) => Math.ceil(amount / (fbr * RECOVERY_RATE));
const asked = IMPACT.askedCases.map((c) => ({ amount: c.amount, months: repayMonths(c.amount) }));
const cents = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** SSI Annual Statistical Report 2024, Tables 8 and 12: people whose check was lowered for support and maintenance, and the average counted. */
export const ISM_COUNTED = { people: 454_843, averageMonthly: 247, month: "December 2024" };
/** FY 2025 Agency Financial Report, SSI improper payment causes FY 2020 to 2024, in millions of dollars. */
export const ISM_IMPROPER = { over: 1527.29, under: 1315.12, total: 2842.41, yearlyAverage: 568.48, share: 8.59 };
/** SSI Annual Statistical Report 2024, Tables 76 and 77: payments suspended and ended for savings over the limit, in 2024. */
export const EXCESS_RESOURCES = { suspended: 83_110, terminated: 45_146, limitSince: "January 1, 1989", limit: facts.values.resource_limit_individual.value };
/** ISS Market Intelligence, as of June 30, 2026. */
export const ABLE_MARKET = { accounts: "263,000", assets: "$3.6 billion", asOf: "June 30, 2026" };

/** The scale of the problem: what SSA counts, what it overpays and underpays, and what it says it can see. The first three show open. */
export const SCALE: Figure[] = [
  {
    id: "asr-counted",
    figure: ISM_COUNTED.people.toLocaleString("en-US"),
    measures: `people on SSI whose check Social Security lowered in ${ISM_COUNTED.month} because someone else helped with their shelter, by an average of ${cents(ISM_COUNTED.averageMonthly)} a month (support and maintenance counted as income, SSA's 100 percent record data). Food stopped counting on September 30, 2024, so nearly all of this is housing help; the January 2022 count was 793,000.`,
    inGiftwise: "Help with rent or utilities goes through an ABLE account where the person can have one, and the engine shows the lower check before anyone pays where they cannot, so help from family does not become this line on the record.",
    code: ["src/lib/rules/engine.ts", "src/lib/impact.ts"],
    source: "ssa-asr-2024-sect02",
    sourceLabel: "SSI Annual Statistical Report 2024, Tables 8 and 12",
  },
  {
    id: "afr-ism-share",
    figure: `${ISM_IMPROPER.share} percent`,
    measures: `of SSI improper payments over fiscal years 2020 through 2024 came from in-kind support and maintenance: about $${(ISM_IMPROPER.over / 1000).toFixed(1)} billion paid too much and $${(ISM_IMPROPER.under / 1000).toFixed(1)} billion paid too little, about $${Math.round(ISM_IMPROPER.yearlyAverage)} million a year, the third largest cause of overpayments. SSA's report says self-reporting is its primary tool for learning of changes that affect it.`,
    inGiftwise: "Each month's report to Social Security is built from PayPal's records, lists every gift with the rule that applies, and can be checked by anyone, so a report replaces a recollection.",
    code: ["src/lib/report/ssa.ts", "src/lib/report/verify.ts"],
    source: "ssa-afr-2025-payment-integrity",
    sourceLabel: "SSA FY 2025 Agency Financial Report, payment integrity",
  },
  {
    id: "oig-no-tools",
    figure: "No tools",
    measures: "to identify living arrangement errors, in SSA's words to its Inspector General for fiscal year 2025, when it named financial accounts, wages and in-kind support and maintenance as the leading causes of SSI overpayments; the program relies on recipients to report changes.",
    inGiftwise: "The housing question is decided in code before the money moves, with 0 of 55 gifts that would lower the check let through on the cases whose answer is known, and the audit ledger can be recomputed by anyone.",
    code: ["src/lib/review/referee.ts", "src/lib/audit.ts", "src/lib/error-rates.ts"],
    source: "ssa-oig-152601",
    sourceLabel: "SSA Inspector General, July 2026",
  },
  {
    id: "oig-9-percent",
    figure: "9 percent",
    measures: "of SSI overpayments assessed in fiscal years 2020 through 2023 that SSA attributed to unreported changes in living arrangements or receipt of in-kind support and maintenance; 51 percent to unreported wages, self-employment or other income, a share that includes cash gifts without breaking them out.",
    inGiftwise: "A gift is checked against the rules before it is given and the shop or the ABLE account is paid rather than the person, so there is neither cash income nor in-kind support left to report.",
    code: ["src/lib/rules/engine.ts", "src/lib/routing.ts"],
    source: "ssa-oig-062405",
    sourceLabel: "SSA Inspector General, February 2025",
  },
  {
    id: "fr-rental-132",
    figure: "$132 a month",
    measures: "the average rise in payments SSA projected for about 41,000 people already on SSI when its rental subsidy rule took effect, with about $837 million more in federal SSI payments over fiscal years 2024 through 2033: SSA's own pricing of how much housing help from others had been lowering checks.",
    inGiftwise: "The engine prices housing help by the same rule, capped at the presumed maximum value less $20, and routes rent and utilities through an ABLE account where the person can have one.",
    code: ["src/lib/impact.ts", "src/lib/rules/engine.ts"],
    source: "fr-89-25507-rental-subsidy",
    sourceLabel: "89 FR 25507, April 2024",
  },
  {
    id: "fr-food-1-6b",
    figure: "$1.6 billion",
    measures: "SSA's actuaries' estimate of the rise in federal SSI payments over fiscal years 2024 through 2033 from no longer counting food help, in the rule where SSA wrote that its in-kind support calculations had historically been a significant cause of payment errors.",
    inGiftwise: "Food help has not counted since September 30, 2024, and the engine says so on every grocery gift; the rules watch asks the Federal Register for each later change.",
    code: ["src/lib/rules/table.ts", "src/lib/rules-watch.ts"],
    source: "fr-89-21199",
    sourceLabel: "89 FR 21199, March 2024",
  },
  {
    id: "em-recovery-10",
    figure: "10 percent",
    measures: `of the monthly check is the rate at which SSA recovers an SSI overpayment (the Title II default rose to 50 percent in 2025; Title XVI stayed at 10 percent). On a ${cents(fbr)} check that is ${cents(fbr * RECOVERY_RATE)} a month, so the overpayments in the two court cases on this page, ${asked.map((a) => `${cents(a.amount)}`).join(" and ")}, would take ${asked.map((a) => a.months).join(" and ")} months to repay.`,
    inGiftwise: "Routed through the engine from each case's facts, the same help paid into an ABLE account keeps her savings under the limit in every month, so there is nothing to ask back and nothing to repay.",
    code: ["scripts/run-field-cases.ts", "src/lib/impact.ts"],
    source: "ssa-em-25029-rev",
    sourceLabel: "SSA EM-25029 REV, August 2025",
  },
];

/** The $2,000 limit and ABLE's reach, each with its source. */
export const LIMIT: Figure[] = [
  {
    id: "asr-excess-resources",
    figure: EXCESS_RESOURCES.suspended.toLocaleString("en-US"),
    measures: `people had SSI payments suspended in 2024 for savings over the limit, and ${EXCESS_RESOURCES.terminated.toLocaleString("en-US")} had them ended, under a limit of ${cents(EXCESS_RESOURCES.limit)} for one person that has not changed since ${EXCESS_RESOURCES.limitSince} (POMS SI 01110.003). Excess resources is the third largest reason for a suspension.`,
    inGiftwise: "A gift paid to a shop, a clinic or an ABLE account never lands in the account that is measured, and the engine shows savings against the limit after each gift.",
    code: ["src/lib/rules/engine.ts", "scripts/run-field-cases.ts"],
    source: "ssa-asr-2024-sect11",
    sourceLabel: "SSI Annual Statistical Report 2024, Tables 76 and 77",
  },
  {
    id: "oact-savings-penalty",
    figure: "$8.9 billion",
    measures: "over 2025 through 2034 is the Chief Actuary's estimate of the added federal SSI payments if the SSI Savings Penalty Elimination Act (S. 1234) raised the limit to $10,000 for one person and $20,000 for a couple from January 2027 and indexed it to prices. The bill has not passed.",
    inGiftwise: "Giftwise works under the limit in force today, and its parameters file carries the limit so a change is one line.",
    code: ["src/lib/rules/params.ts", "content/facts.json"],
    source: "ssa-oact-cassidy-2026",
    sourceLabel: "SSA Chief Actuary, August 2026",
  },
  {
    id: "able-reach",
    figure: ABLE_MARKET.accounts,
    measures: `ABLE accounts held ${ABLE_MARKET.assets} on ${ABLE_MARKET.asOf}, against roughly 14 million people who can open one since the age limit rose to 46 on January 1, 2026 (ABLE National Resource Center). SSA's manual excludes third-party deposits into an ABLE account from income whatever their status as a gift, excludes the first $100,000 of the balance from savings, and sets the yearly limit at $20,000 for 2026.`,
    inGiftwise: "The ABLE share of each gift is computed within the yearly limit across every giver on the page and sent to the plan's own gift page; housing money is flagged to be spent in the month it is withdrawn.",
    code: ["src/lib/rules/engine.ts", "src/lib/households.ts"],
    source: "iss-able-2q-2026",
    sourceLabel: "ISS Market Intelligence, August 2026; POMS SI 01130.740",
  },
];

/** Published evidence that doing the steps beats explaining them, each as what it measured in its own program. */
export const UPTAKE: { id: string; who: string; found: string; source: string }[] = [
  { id: "finkelstein-notowidigdo-2019", who: "Finkelstein and Notowidigdo, 2019", found: "In a randomized trial of about 30,000 older people likely eligible for SNAP, 6 percent of the control group enrolled within nine months, 11 percent of those sent information, and 18 percent of those sent information and offered help with the application.", source: "finkelstein-notowidigdo-2019" },
  { id: "bendtsen-2026-takeup", who: "Bendtsen, 2026", found: "Across 51 field experiments with 187 effect sizes, help that reduces what applicants must do raised take-up by 8.3 percentage points on average; information that reduces what they must learn, by 3.4 points.", source: "bendtsen-2026-takeup" },
  { id: "wright-2017-medicaid", who: "Wright, Garcia-Alexander, Weller and Baicker, 2017", found: "Low-cost mailings in Oregon raised Medicaid enrollment among lottery selectees from 27 percent to about 41 percent, and among people presumed eligible by about 3 points, at about $2.50 a person.", source: "wright-2017-medicaid" },
  { id: "fannin-2024-wic", who: "Fannin, Heflin and Lopoo, 2024", found: "Waiving in-person certification raised WIC caseloads by about 11 percent, with no detectable effect in counties that kept paper document steps or offered only curbside rather than fully remote certification.", source: "fannin-2024-wic" },
  { id: "manoli-turner-2014", who: "Manoli and Turner, 2014 (working paper)", found: "An IRS reminder with a simplified form led nearly 80 percent of apparently eligible childless filers to claim the EITC that year; the effect fell to about 22 percent a year later, so a one-time nudge fades.", source: "manoli-turner-2014" },
];

/** The law, the code and the test on one line: the rules that make the vendor-pay and ABLE routes non-countable, and the housing cap. */
export const LAW: { route: string; law: { key: string; label: string }[]; rule: string; code: string; test: string }[] = [
  {
    route: "Paid to the shop, the clinic or the school",
    law: [
      { key: "cfr-416-1103-g", label: "20 CFR 416.1103(g)" },
      { key: "poms-si-00815-400", label: "POMS SI 00815.400, Bills Paid by Third Party" },
    ],
    rule: "R-VEND-01",
    code: "evaluateGift() in src/lib/rules/engine.ts",
    test: "tests/rules.test.ts: paying the shop directly keeps the full check",
  },
  {
    route: "Paid into the person's ABLE account",
    law: [
      { key: "poms-si-01130-740", label: "POMS SI 01130.740, ABLE accounts" },
      { key: "ssa-spotlight-able-2026", label: "SSA Spotlight on ABLE accounts" },
    ],
    rule: "R-ABLE-01, R-ABLE-02",
    code: "evaluateGift() in src/lib/rules/engine.ts; withAbleSoFar() in src/lib/households.ts",
    test: "tests/rules.test.ts: a deposit into ABLE keeps the full check; tests/invariants.test.ts: ABLE within its yearly limit",
  },
  {
    route: "Rent or utilities paid to the landlord",
    law: [
      { key: "cfr-416-1130", label: "20 CFR 416.1130" },
      { key: "poms-si-00835-360", label: "POMS SI 00835.360, third-party vendor payments" },
    ],
    rule: "R-SHEL-01",
    code: "computeMonth() in src/lib/rules/engine.ts; housingReach() in src/lib/impact.ts",
    test: "tests/rules.test.ts: housing help counts up to the presumed maximum value less $20",
  },
  {
    route: "Cash, and gift cards that can buy food or shelter",
    law: [
      { key: "cfr-416-1121", label: "20 CFR 416.1121" },
      { key: "poms-si-00830-520", label: "POMS SI 00830.520, Gifts" },
      { key: "poms-si-00830-522", label: "SI 00830.522, Gift cards" },
    ],
    rule: "R-CASH-01",
    code: "evaluateGift() in src/lib/rules/engine.ts; the gift finder holds gift cards back in src/lib/channel3.ts",
    test: "tests/rules.test.ts: a cash gift counts after the $20 and $60 exclusions; tests/held-out.test.ts: SSA's gift-card examples",
  },
];

export const sourceOf = (key: string) => SRC[key];
