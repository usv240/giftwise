import { SHELTER_CATEGORIES, usd, type Category, type Gift } from "@/lib/rules";
import type { Decision } from "./referee";

/**
 * When a bill read by Claude goes to the two reviewers before Giftwise picks its route, and the words they read.
 * Client-safe: the Try page builds the same description for a live rerun.
 */

/** A bill as read: the fields the routing decision uses. */
export type ReadBill = { vendor_name: string; vendor_category: Category; amount_due: number; due_date: string | null; confidence: number; line_items?: { description: string; amount: number }[] | null };

/** Below this, the reading itself is not sure enough to route a bill on one category. */
export const REVIEW_BELOW_CONFIDENCE = 0.9;

/** Categories at or next to housing: the housing ones themselves, and the services often billed with them. */
const NEAR_HOUSING_CATEGORIES: readonly Category[] = [...SHELTER_CATEGORIES, "internet", "phone"];

/** Words on a bill that put it near housing, whatever category the reading chose. */
const HOUSING_WORDS: [RegExp, string][] = [
  [/\b(rent|rental|lease|landlord|tenant|tenancy|apartment|lot rent|room and board)\b/i, "rent"],
  [/\b(mortgage|escrow|property tax(es)?|real estate tax(es)?)\b/i, "a mortgage or property tax"],
  [/\b(hoa|homeowners'? association|condo(minium)? (fee|dues|association)|association dues)\b/i, "association dues (HOA)"],
  [/\bdeposit\b/i, "a deposit"],
  [/\binsurance\b/i, "insurance"],
  [/\b(water|sewer|sewage|wastewater)\b/i, "water or sewer"],
  [/\b(trash|garbage|refuse|recycling|waste (collection|removal|management))\b/i, "trash pickup"],
  [/\b(internet|broadband|wi-?fi|cable tv)\b/i, "internet"],
  [/\b(electric(ity)?|natural gas|propane|heating (oil|fuel)|utilit(y|ies))\b/i, "a utility"],
];

/** The text the reviewers read: the vendor, then every line item with its amount. */
export function billDescription(b: Pick<ReadBill, "vendor_name" | "line_items">) {
  return [`${b.vendor_name}.`, ...(b.line_items ?? []).map((l) => `${l.description}: ${usd(l.amount)}`)].join(" ");
}

/**
 * Why this bill goes to the two reviewers, in plain words; empty when one reading is enough. A bill goes to them when
 * its category is at or next to housing, when the vendor or a line item uses a housing word, or when Claude was less
 * than 90% sure of its own reading.
 */
export function reviewReasons(b: ReadBill): string[] {
  const reasons: string[] = [];
  if (NEAR_HOUSING_CATEGORIES.includes(b.vendor_category)) reasons.push(`It was read as a ${b.vendor_category.replace("_", " ")} bill, which sits at or next to housing.`);
  const text = billDescription(b);
  const words = [...new Set(HOUSING_WORDS.filter(([re]) => re.test(text)).map(([, label]) => label))];
  if (words.length) reasons.push(`The bill mentions ${words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`}.`);
  if (b.confidence < REVIEW_BELOW_CONFIDENCE) reasons.push(`Claude was ${Math.round(b.confidence * 100)}% sure of its reading, under the ${Math.round(REVIEW_BELOW_CONFIDENCE * 100)}% Giftwise asks for.`);
  return reasons;
}

/** The gift the rules engine checks for paying this bill. */
export const billGift = (b: ReadBill, date: string): Gift => ({ id: "bill", date: b.due_date ?? date, amount: b.amount_due, delivery: "vendor", category: b.vendor_category, label: b.vendor_name });

/** One reading is enough: the category Claude read decides whether the bill is a housing cost. */
export const readingDecision = (b: ReadBill): Decision => (SHELTER_CATEGORIES.includes(b.vendor_category) ? "shelter" : "not_shelter");
