export type Delivery = "cash" | "vendor" | "item" | "able";

export type Category =
  | "medical"
  | "equipment"
  | "phone"
  | "internet"
  | "education"
  | "utility"
  | "rent"
  | "mortgage"
  | "property_tax"
  | "food"
  | "clothing"
  | "transport"
  | "personal"
  | "event"
  | "other";

export const SHELTER_CATEGORIES: readonly Category[] = ["rent", "mortgage", "property_tax", "utility"];

/** How often a housing bill is paid when it is not paid by the month: weekly, or every two weeks (POMS SI 00835.474 B.3). */
export type Every = "week" | "two_weeks";

/** Whose check it is, for the wording only: she/her, he/him or they/them. */
export type Pronoun = "she" | "he" | "they";

export interface Profile {
  /** Wording only; never changes the math. Defaults to she/her. */
  pronoun?: Pronoun;
  couple: boolean;
  /**
   * Lives all month in another person's household: someone else owns or rents the home, and she has neither ownership
   * nor rental liability (POMS SI 00835.120). The household's own shelter then counts every month, gift or not, unless
   * she pays her pro rata share of its costs (R-SHEL-08): with no householdPays stated she is taken to pay nothing.
   */
  livesInAnothersHousehold: boolean;
  /**
   * In another person's household, whether the household pays for or provides all of the person's meals. The one-third
   * reduction applies only then (20 CFR 416.1131(a)(3), as amended in 2024); otherwise shelter help is valued under the
   * presumed maximum value rule (20 CFR 416.1140). Leave it unset to mean yes.
   */
  householdProvidesAllMeals?: boolean;
  otherUnearnedMonthly: number;
  earnedMonthly: number;
  ableEligible: boolean;
  ableBalance: number;
  ableContributedThisYear: number;
  /** Countable savings at the start of the month the gift arrives. */
  savings: number;
  /**
   * The people in her household, herself included (both members of a couple). Housing paid from outside the household
   * is divided equally among them, and she is charged her share (POMS SI 00835.350 B.4); for a couple, one member's
   * share times two (C). A rental subsidy is divided the same way (SI 00835.380 D.1.d). Leave it unset for one person,
   * or a couple, with no one else in the household (R-SHEL-07).
   */
  householdSize?: number;
  /**
   * In another person's household: its monthly operating expenses, the rent or mortgage, property tax, heating fuel,
   * gas, electricity, water, sewer and garbage, less any of them someone outside the household pays (20 CFR 416.1133(c)).
   * Food has not been one of them since September 30, 2024. Divided by householdSize, times two for a couple, it gives
   * her pro rata share (R-SHEL-08).
   */
  householdCosts?: number;
  /** Her pro rata share of those expenses when it is stated directly (the couple's together); it takes the place of householdCosts. */
  proRataShare?: number;
  /**
   * What she (or the couple) pays toward the household's operating expenses each month, in cash. Money set aside for her
   * food is not part of it, and neither are services such as lawn care (POMS SI 00835.480 C). Leave it out to mean nothing.
   */
  householdPays?: number;
}

/**
 * Help she must repay, not a gift (20 CFR 416.1103(f)). Cash lent to her follows POMS SI 01120.220; food or shelter lent
 * in kind, paid to a business or given as itself, follows SI 00835.482. It is a bona fide loan only when every fact
 * below holds; when one does not, the help counts as SSA counts any other help (R-LOAN-01, R-LOAN-02). Repaying a bona
 * fide loan later does not lower her countable income.
 */
export interface Loan {
  /** She must repay it whether or not SSI or any other benefit is ever paid: the obligation is unconditional (SI 00835.482 B.3, SI 01120.220 D.3). */
  mustRepay: boolean;
  /** She and the lender both agreed she would repay at the time it was given, not afterwards (SI 00835.482 B.2 and B.3). */
  agreedWhenGiven: boolean;
  /** A plan to repay from her own income, benefits she expects included, or property, that she can meet; services do not count (SI 00835.482 B.4 and B.5). */
  feasiblePlan: boolean;
  /** Enforceable under the State's law as an oral or written contract (SI 00835.482 B.1). Leave it out to mean yes. */
  enforceable?: boolean;
  /** What she agreed to repay, when it is less than the amount: her share of a bill paid for the household (SI 00835.482 B.4). Leave it out for the full amount. */
  repay?: number;
  /**
   * The household she lives in is the lender, lending its own shelter (SI 00835.482 D to F). The amount borrowed each
   * month counts with what she pays toward her share of its costs (R-SHEL-08); when those costs are not stated, a bona
   * fide loan of the household's shelter is taken to cover her share (SI 00835.482 F.2.b).
   */
  fromHousehold?: boolean;
}

export interface Gift {
  id: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  amount: number;
  delivery: Delivery;
  category: Category;
  giver?: string;
  /** True when the same giver pays this every month (or more than once a quarter). */
  recurring?: boolean;
  /**
   * For a housing bill paid ahead or behind: the months it covers, YYYY-MM to YYYY-MM. The part for months up to the
   * payment month counts in the payment month; each later month's share counts in that month (R-SHEL-02). When the
   * payer co-owns the home, each month's share counts in that month, past months included (R-SHEL-04).
   */
  covers?: { from: string; to: string };
  /**
   * The person paying co-owns the home, so the payment is not a gift (POMS SI 00835.360 D.3). With `covers`, each
   * month's share counts in its own month, past months included, instead of the past months counting when it is paid.
   */
  payerCoOwns?: boolean;
  /**
   * Rent below market from a landlord who is her parent or child (POMS SI 00835.380): the monthly rent she pays. The
   * gift's amount is the market rent less that rent. The subsidy counted is the lesser of the market rent and the
   * presumed maximum value, less the rent she pays, and none once her rent reaches either (R-SHEL-05). It is valued
   * for a household of one; SSA divides it among the household's members.
   */
  rentPaid?: number;
  /**
   * For rent or another housing bill paid to the landlord or company weekly or every two weeks: the amount is one
   * payment. The month counts the converted monthly amount, the weekly amount times 13 divided by 3, a two-week amount
   * halved first, however many payment days fall in the month (POMS SI 00835.474 B.3). The payments one giver makes
   * toward one bill in a month are one weekly amount (R-SHEL-06).
   */
  every?: Every;
  /** Help she must repay: a loan, with the facts that decide whether SSA treats it as one (R-LOAN-01, R-LOAN-02). */
  loan?: Loan;
  label?: string;
}

/**
 * Her place in another person's household for one month (R-SHEL-08): her pro rata share of its operating expenses, what
 * she pays toward them, and the rule that follows (20 CFR 416.1131 and 416.1133; POMS SI 00835.160, SI 00835.340).
 */
export interface HouseholdTest {
  /** Her pro rata share of the household's monthly operating expenses, the couple's together; null when not known. */
  share: number | null;
  /** What she pays toward them, with any bona fide loan of the household's shelter that month (R-LOAN-02). */
  pays: number;
  /** She pays her share, or within $20 of it, so she lives in her own household and gets no support from it (SI 00835.160 C.2). */
  sharing: boolean;
  /**
   * vtr: the one-third reduction, because the household gives her shelter and all her meals (20 CFR 416.1131(a)).
   * pmv: the shelter it gives her counts as in-kind support under the presumed maximum value, because it does not give
   * her all her meals (20 CFR 416.1131(a)(3), POMS SI 00835.340). none: she pays her share.
   */
  rule: "vtr" | "pmv" | "none";
  /** Under pmv, the shelter's value: her share less what she pays, or the presumed maximum value when her share is not known. */
  value: number;
}

/** unearned_in_kind: an item or service she receives that is not food, shelter or something for personal use, counted at its value. */
export type TreatmentKind = "unearned_cash" | "unearned_in_kind" | "ism_shelter" | "excluded" | "not_possible";

export interface Treatment {
  kind: TreatmentKind;
  ruleIds: string[];
  /** Eligible for the infrequent or irregular income exclusion. */
  infrequentEligible: boolean;
  ambiguous: boolean;
  ambiguityReason?: string;
  note?: string;
}

/**
 * Countable resources on the 1st of a month (R-RES-01): the savings and other resources she states, and the part of her
 * ABLE account over $100,000 (R-ABLE-03, POMS SI 01130.740 D.1).
 */
export interface ResourceTest {
  /** The 1st of the month the test is for, YYYY-MM-01. */
  on: string;
  /** Countable savings and other resources, before any ABLE balance. */
  other: number;
  /** Her ABLE balance that day, with the deposits the gifts made before it. */
  ableBalance: number;
  /** The part of the ABLE balance over $100,000, which counts as a resource. */
  ableExcess: number;
  countable: number;
  limit: number;
  over: boolean;
  /**
   * under: at or below the limit. able_suspension: over only because of the ABLE balance, so SSI cash stops while it
   * stays over and Medicaid continues (SI 01130.740 D.1.c). excess: her other resources alone are over the limit, so she
   * is not eligible that month (SI 01110.003 A.1, SI 01130.740 D.1.b).
   */
  status: "under" | "able_suspension" | "excess";
}

export interface MonthTrace {
  month: string;
  cashIncome: number;
  /** Things she receives that count at their value, such as event tickets (R-ITEM-02). */
  inKindIncome: number;
  shelterPaidByOthers: number;
  ismValue: number;
  vtrApplied: boolean;
  /** In another person's household: her share of its costs, what she pays, and the rule that follows (R-SHEL-08). Null otherwise. */
  household: HouseholdTest | null;
  /** How much the one-off exclusion actually lowered countable income this month. */
  infrequentExcluded: number;
  /** How much of the quarter's $60 one-off allowance this month used up, which can be more than it lowered income once the housing cap applies. */
  infrequentUsed: number;
  generalExcludedFromUnearned: number;
  generalExcludedFromEarned: number;
  earnedCountable: number;
  otherUnearned: number;
  countableIncome: number;
  /** The check her income alone gives, before the resource test. */
  incomeCheck: number;
  /** Her countable resources on the 1st of the month the check is paid. Over the limit, the check is $0 (R-RES-01). */
  resources: ResourceTest;
  check: number;
  paymentMonth: string;
}

export interface Explanation {
  plain: string;
  technical: string;
}

export interface GiftResult {
  gift: Gift;
  treatment: Treatment;
  ruleIds: string[];
  sourceKeys: string[];
  incomeMonth: string;
  paymentMonth: string;
  /** How much of this gift ends up counted as income after exclusions. */
  countedAmount: number;
  checkBaseline: number;
  checkAfter: number;
  bestRoute: Delivery;
  checkWithBestRoute: number;
  /** Countable resources on the 1st of next month with the gift as given: cash kept, an ABLE deposit in the account. */
  resourcesNextFirst: number;
  overResourceLimit: boolean;
  /** The resource test on the 1st of next month from the balances she states, without the gift (R-RES-01). */
  resourcesBefore: ResourceTest;
  /** The same test with the gift as given: cash she keeps adds to savings, an ABLE deposit to the account (R-ABLE-03). */
  resourcesAfter: ResourceTest;
  ambiguous: boolean;
  ambiguityReason?: string;
  explanation: Explanation;
  trace: MonthTrace;
  alternatives: { delivery: Delivery; check: number; possible: boolean; reason?: string }[];
}
