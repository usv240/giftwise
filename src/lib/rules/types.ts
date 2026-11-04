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

/** Whose check it is, for the wording only: she/her, he/him or they/them. */
export type Pronoun = "she" | "he" | "they";

export interface Profile {
  /** Wording only; never changes the math. Defaults to she/her. */
  pronoun?: Pronoun;
  couple: boolean;
  /** Lives all month in another person's household and does not pay a share of shelter costs. */
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
   * payment month counts in the payment month; each later month's share counts in that month (R-SHEL-02).
   */
  covers?: { from: string; to: string };
  label?: string;
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

export interface MonthTrace {
  month: string;
  cashIncome: number;
  /** Things she receives that count at their value, such as event tickets (R-ITEM-02). */
  inKindIncome: number;
  shelterPaidByOthers: number;
  ismValue: number;
  vtrApplied: boolean;
  /** How much the one-off exclusion actually lowered countable income this month. */
  infrequentExcluded: number;
  /** How much of the quarter's $60 one-off allowance this month used up, which can be more than it lowered income once the housing cap applies. */
  infrequentUsed: number;
  generalExcludedFromUnearned: number;
  generalExcludedFromEarned: number;
  earnedCountable: number;
  otherUnearned: number;
  countableIncome: number;
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
  resourcesNextFirst: number;
  overResourceLimit: boolean;
  ambiguous: boolean;
  ambiguityReason?: string;
  explanation: Explanation;
  trace: MonthTrace;
  alternatives: { delivery: Delivery; check: number; possible: boolean; reason?: string }[];
}
