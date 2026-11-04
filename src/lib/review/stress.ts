import bills from "../../../content/eval/bills.json";
import hard from "../../../content/eval/bills-hard.json";
import results from "../../../content/eval-results.json";
import { DEFAULT_PROFILE, SHELTER_CATEGORIES, evaluateGift, type Category, type Gift } from "@/lib/rules";
import { PASSAGES, referee, routeForDecision, type Answer, type AuthorityId, type Decision, type Review } from "./referee";

/**
 * What the second reviewer and the referee are for: one reviewer being wrong. For each labeled bill, take the two
 * reviewers' recorded answers and make one of them wrong in two ways: the wrong answer with a real quote from its own
 * rulebook, or the wrong answer with a quote that is not in the rulebook. Then ask where the money would go if Giftwise
 * trusted that reviewer alone, and where it goes with both reviewers and the referee, scored against the true label.
 * Pure and deterministic: it reuses the recorded run, so it calls no AI.
 */
type Truth = "shelter" | "not_shelter" | "contested";
type Case = { id: string; set?: string; category?: string; truth: Truth; regs: { answer: string; passage: string }; poms: { answer: string; passage: string } };
type BillCase = { id: string; category: string };

const CASES = (results as unknown as { cases: Case[] }).cases;
const AMOUNT = (results as unknown as { amount: number }).amount;

const BILLS: Record<string, BillCase[]> = { first: (bills as { cases: BillCase[] }).cases, hard: (hard as { cases: BillCase[] }).cases };
const categoryOf = (c: Case): Category => (c.category ?? BILLS[c.set ?? "first"]?.find((b) => b.id === c.id)?.category ?? "other") as Category;

/** A review whose quote is the first 80 characters of a real passage, so it passes the word-for-word check. */
function honest(authority: AuthorityId, answer: Answer, passageId: string): Review {
  const p = PASSAGES.find((x) => x.id === passageId) ?? PASSAGES.find((x) => x.authority === authority)!;
  return { authority, answer, passage_id: p.id, quote: p.text.replace(/\s+/g, " ").slice(0, 80), reason_plain: "", reason_technical: "", confidence: 0.9 };
}

const flip = (a: Answer): Answer => (a === "shelter" ? "not_shelter" : "shelter");

/** The check under the true label: for a contested bill, the worse of the two readings. */
function checkUnderTruth(gift: Gift, truth: Truth, route: "vendor" | "able" | null) {
  if (!route) return null;
  const cat = gift.category;
  const readings: Category[] = truth === "contested" ? [SHELTER_CATEGORIES.includes(cat) ? cat : "utility", "other"] : [cat];
  return Math.min(...readings.map((category) => evaluateGift({ ...gift, delivery: route, category }, DEFAULT_PROFILE).checkAfter));
}

export type StressRow = { id: string; truth: Truth; aloneWhole: boolean; refereeRealQuoteWhole: boolean; refereeInventedQuoteWhole: boolean };

export function stressTest() {
  const rows: StressRow[] = [];
  for (const c of CASES) {
    const gift: Gift = { id: c.id, date: "2026-04-10", amount: AMOUNT, delivery: "vendor", category: categoryOf(c) };
    const full = evaluateGift({ ...gift, delivery: "able" }, DEFAULT_PROFILE).checkBaseline;
    // The honest reviewer gives the true answer; for a contested bill it keeps its recorded answer.
    const trueAnswer = (c.truth === "contested" ? c.poms.answer : c.truth) as Answer;
    const good = honest("poms", trueAnswer === "unclear" ? "shelter" : trueAnswer, c.poms.passage);
    const wrongAnswer = flip(trueAnswer === "unclear" ? "shelter" : trueAnswer);
    const wrongReal = honest("regs", wrongAnswer, c.regs.passage);
    const wrongInvented: Review = { ...wrongReal, quote: "Payments for this kind of bill are never counted as income in any month." };
    const whole = (decision: Decision) => checkUnderTruth(gift, c.truth, routeForDecision(gift, decision).route) === full;
    rows.push({
      id: c.id,
      truth: c.truth,
      aloneWhole: whole(wrongAnswer as Decision),
      refereeRealQuoteWhole: whole(referee([good, wrongReal]).decision),
      refereeInventedQuoteWhole: whole(referee([good, wrongInvented]).decision),
    });
  }
  const n = rows.length;
  return {
    bills: n,
    aloneWhole: rows.filter((r) => r.aloneWhole).length,
    refereeRealQuoteWhole: rows.filter((r) => r.refereeRealQuoteWhole).length,
    refereeInventedQuoteWhole: rows.filter((r) => r.refereeInventedQuoteWhole).length,
    rows,
  };
}
