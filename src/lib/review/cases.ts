import type { RecordedReview, ReviewInput } from "@/components/try/ReviewPanel";
import { SHELTER_CATEGORIES } from "@/lib/rules";
import { getPreset } from "@/lib/presets";
import electric from "../../../content/reviews/electric-bill.json";

/** What the reviewers are told about each example bill: the business and the service, as the bill states it. */
const DESCRIPTIONS: Record<string, string> = {
  "electric-bill": "Northside Electric Co-op (sample). Monthly bill for residential electric service at her apartment.",
  "rent-help": "Monthly rent for her apartment, paid to the landlord (sample).",
};

/** Recorded runs, so the example pages show a full review without waiting. Re-record with scripts/record-reviews.ts. */
const RECORDED: Record<string, RecordedReview> = { "electric-bill": electric as RecordedReview };

/** The review input for a preset, when the reviewers apply to it: a bill paid to a business for a possible housing cost. */
export function reviewForPreset(id: string): { input: ReviewInput; recorded?: RecordedReview } | null {
  const p = getPreset(id);
  const g = p?.gift;
  if (!g || g.delivery !== "vendor" || !SHELTER_CATEGORIES.includes(g.category) || !DESCRIPTIONS[id]) return null;
  return { input: { description: DESCRIPTIONS[id], amount: g.amount, category: g.category, date: g.date, recurring: g.recurring }, recorded: RECORDED[id] };
}
