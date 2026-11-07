import results from "../../../content/eval-results.json";
import { referee, routeForDecision, type Answer, type AuthorityId, type Review } from "./referee";
import type { Category, Gift } from "@/lib/rules";

/** The bill shown: the two reviewers read it from their own rulebooks, quote them word for word, and disagree. */
export const REFEREE_EXAMPLE = "home-insurance";

type Vote = { answer: string; passage: string; cite: string; quote: string; quote_checked: boolean; reason: string };
type Case = { id: string; description: string; category: string; regs: Vote; poms: Vote };
export const R = results as unknown as { ran_at: string; model: string; amount: number; cases: Case[] };

/**
 * One recorded bill where the two Claude reviewers disagree, both quoting their rulebook word for word, and the code
 * that decides. The quotes and answers are from the recorded run (content/eval-results.json); the referee's decision and
 * the route are computed here by referee() and routeForDecision(), the same code the API uses, so no model is called.
 */
export function refereeExample() {
  const c = R.cases.find((x) => x.id === REFEREE_EXAMPLE)!;
  const ids: AuthorityId[] = ["regs", "poms"];
  const reviews: Review[] = ids.map((a) => ({ authority: a, answer: c[a].answer as Answer, passage_id: c[a].passage, quote: c[a].quote, reason_plain: c[a].reason, reason_technical: c[a].reason, confidence: 1 }));
  const decided = referee(reviews);
  const gift: Gift = { id: c.id, date: "2026-04-10", amount: R.amount, delivery: "vendor", category: c.category as Category };
  const routed = routeForDecision(gift, decided.decision);
  const shop = routed.routes.find((r) => r.delivery === "vendor")!;
  const able = routed.routes.find((r) => r.delivery === "able")!;
  const [payee, ...rest] = c.description.split(". ");
  return { c, ids, decided, routed, shop, able, payee, what: rest.join(". ") };
}
