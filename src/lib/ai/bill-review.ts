import { log } from "@/lib/log";
import { billDescription, billGift, readingDecision, reviewReasons, type ReadBill } from "@/lib/review/bill-route";
import { routeForDecision, type Decision } from "@/lib/review/referee";
import { DEFAULT_PROFILE, type Category, type Profile } from "@/lib/rules";
import { AiRefusedError, AiUnavailableError, aiAvailable } from "./claude";
import { reviewPayload, runReviewers } from "./reviewers";

export type BillRoute = {
  delivery: "vendor" | "able" | null;
  check_after: number | null;
  /** reading: one confident reading away from housing. reviewers: the referee, on both checked answers. both_readings: the reviewers could not run, so the route that keeps the check whole under either reading. */
  decided_by: "reading" | "reviewers" | "both_readings";
  decision: Decision;
  readings: Category[];
  rule_ids: string[];
  reviewed_because: string[];
  note: string | null;
};

/**
 * Route a bill Claude has read. A bill at or near housing, or one Claude was not sure of, goes to the two reviewers
 * (src/lib/ai/reviewers.ts) and the referee decides; any other bill is routed on its one reading. When the reviewers
 * cannot run (the AI is paused or busy, or an answer was refused), the bill is routed the way that keeps her check
 * whole under either reading, which is what the referee does when it is unsure.
 */
export async function routeReadBill(bill: ReadBill, date: string, profile: Profile = DEFAULT_PROFILE) {
  const gift = billGift(bill, date);
  const reasons = reviewReasons(bill);
  let review: ReturnType<typeof reviewPayload> | null = null;
  let reviewReplayed = false;
  let decision: Decision = readingDecision(bill);
  let decidedBy: BillRoute["decided_by"] = "reading";
  let note: string | null = null;
  if (reasons.length) {
    try {
      const run = await runReviewers({ description: billDescription(bill), gift }, profile);
      review = reviewPayload(run);
      reviewReplayed = run.replayed;
      decision = run.decision;
      decidedBy = "reviewers";
    } catch (e) {
      // The AI being paused, busy or refusing is expected now and then; anything else is logged as an error so it shows.
      if (e instanceof AiUnavailableError || e instanceof AiRefusedError) log.warn("bill reviewers did not run", { err: e.message.slice(0, 120) });
      else log.error("bill reviewers failed", { err: e });
      decision = "unsure";
      decidedBy = "both_readings";
      note = aiAvailable()
        ? "The two reviewers could not run just now, so Giftwise uses the way that keeps her check whole under either reading."
        : "The two reviewers could not run on this bill: with no AI key on this server they answer only the recorded examples, so Giftwise uses the way that keeps her check whole under either reading.";
    }
  }
  const outcome = routeForDecision(gift, decision, profile);
  const route: BillRoute = {
    delivery: outcome.route,
    check_after: outcome.check,
    decided_by: decidedBy,
    decision,
    readings: outcome.readings,
    rule_ids: outcome.ruleIds,
    reviewed_because: reasons,
    note,
  };
  return { route, review, reviewReplayed };
}
