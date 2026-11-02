import authorities from "../../../content/authorities.json";
import { DEFAULT_PROFILE, SHELTER_CATEGORIES, evaluateGift, type Category, type Delivery, type Gift, type Profile } from "@/lib/rules";

/**
 * Two reviewers, two authorities, one deterministic referee.
 * Each reviewer reads only its own rulebook and must quote it word for word. The referee is plain code:
 * it checks every quote against the passage it cites, and Giftwise acts on a reading only when both
 * checked answers agree. The rules engine still does all the money math.
 */

export type AuthorityId = "regs" | "poms";
export type Passage = { id: string; authority: AuthorityId; cite: string; url: string; section_heading?: string; text: string };

export const PASSAGES = (authorities as { passages: Passage[] }).passages;
export const AUTHORITIES_FETCHED = (authorities as { fetched: string }).fetched;

export const AUTHORITY: Record<AuthorityId, { id: AuthorityId; name: string; reads: string }> = {
  regs: { id: "regs", name: "Regulations reviewer", reads: "the federal regulations (20 CFR Part 416) and the Federal Register" },
  poms: { id: "poms", name: "Manual reviewer", reads: "Social Security's operating manual (POMS)" },
};

export const passagesFor = (a: AuthorityId) => PASSAGES.filter((p) => p.authority === a);

export type Answer = "shelter" | "not_shelter" | "unclear";
export type Review = { authority: AuthorityId; answer: Answer; passage_id: string; quote: string; reason_plain: string; reason_technical: string; confidence: number };
export type Vote = Review & { valid: boolean; setAsideReason?: string; passage?: Passage };
export type Decision = "shelter" | "not_shelter" | "unsure";

const norm = (s: string) =>
  s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** A vote counts only if its quote appears, word for word, in a passage from its own rulebook. */
export function checkVote(r: Review, passages: Passage[] = PASSAGES): Vote {
  const p = passages.find((x) => x.id === r.passage_id);
  if (!p) return { ...r, valid: false, setAsideReason: "It cited a passage that is not in any rulebook Giftwise holds." };
  if (p.authority !== r.authority) return { ...r, valid: false, setAsideReason: "It cited a passage from the other reviewer's rulebook." };
  const q = norm(r.quote).replace(/^["'\s.]+|["'\s]+$/g, "");
  if (q.length < 20) return { ...r, valid: false, setAsideReason: "Its quote is too short to check." };
  if (!norm(p.text).includes(q)) return { ...r, valid: false, setAsideReason: "Its quote does not appear word for word in the passage it cited." };
  return { ...r, valid: true, passage: p };
}

/** Act on a reading only when both reviewers give the same answer and both quotes check out. */
export function referee(reviews: Review[], passages: Passage[] = PASSAGES) {
  const votes = reviews.map((r) => checkVote(r, passages));
  const counted = votes.filter((v) => v.valid && v.answer !== "unclear");
  const agreed = counted.length === 2 && counted[0].answer === counted[1].answer;
  const decision: Decision = agreed ? (counted[0].answer as Decision) : "unsure";
  const setAside = votes.filter((v) => !v.valid);
  let summary: string;
  if (agreed) summary = decision === "shelter" ? "Both reviewers found it in their own rulebook: this bill is a housing cost." : "Both reviewers found it in their own rulebook: this bill is not a housing cost.";
  else if (setAside.length > 0) summary = `${setAside.length === 1 ? "One answer was" : "Both answers were"} set aside because the quote did not check out, so Giftwise uses the way that keeps her check whole under either reading.`;
  else summary = "The reviewers read it differently, so Giftwise uses the way that keeps her check whole under either reading.";
  return { votes, decision, agreed, summary };
}

const BILL_ROUTES = ["vendor", "able"] as const satisfies readonly Delivery[];

/**
 * The route the rules engine picks once the referee has decided. When the decision is "unsure", every route
 * is scored under both readings and the one with the best worst case wins; ties go to paying the shop.
 */
export function routeForDecision(gift: Gift, decision: Decision, profile: Profile = DEFAULT_PROFILE) {
  const isShelter = SHELTER_CATEGORIES.includes(gift.category);
  const shelterReading: Category = isShelter ? gift.category : "utility";
  const otherReading: Category = isShelter ? "other" : gift.category;
  const readings: Category[] = decision === "shelter" ? [shelterReading] : decision === "not_shelter" ? [otherReading] : [shelterReading, otherReading];

  const routes = BILL_ROUTES.map((delivery) => {
    const results = readings.map((category) => evaluateGift({ ...gift, delivery, category }, profile));
    const possible = results.every((r) => r.treatment.kind !== "not_possible");
    return { delivery, possible, check: Math.min(...results.map((r) => r.checkAfter)), ruleIds: [...new Set(results.flatMap((r) => r.ruleIds))] };
  });
  const best = routes.filter((r) => r.possible).reduce<(typeof routes)[number] | null>((a, b) => (!a || b.check > a.check ? b : a), null);
  return { readings, routes, route: best?.delivery ?? null, check: best?.check ?? null, ruleIds: best?.ruleIds ?? [] };
}
