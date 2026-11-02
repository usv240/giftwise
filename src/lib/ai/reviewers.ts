import { z } from "zod";
import { asData, structured } from "./claude";
import { AUTHORITY, passagesFor, referee, routeForDecision, type AuthorityId, type Review } from "@/lib/review/referee";
import { DEFAULT_PROFILE, type Gift, type Profile } from "@/lib/rules";

export type ReviewCase = {
  /** What is being paid for, in the bill's own words: vendor, service, line items. */
  description: string;
  gift: Gift;
};

function schemaFor(authority: AuthorityId) {
  const ids = passagesFor(authority).map((p) => p.id) as [string, ...string[]];
  return z.object({
    answer: z
      .enum(["shelter", "not_shelter", "unclear"])
      .describe("shelter: a housing cost that counts as in-kind support when someone else pays it. not_shelter: anything else. unclear: your passages do not settle it."),
    passage_id: z.enum(ids).describe("The one passage that best supports your answer."),
    quote: z.string().describe("One or two sentences copied word for word from that passage. A program checks the quote; an inexact quote is set aside."),
    reason_plain: z.string().describe("Under 30 words, everyday language, calm and direct. Start with the answer itself, not a preamble."),
    reason_technical: z.string().describe("Which words in the passage decide it, and why."),
    confidence: z.number().min(0).max(1),
  });
}

function systemFor(authority: AuthorityId) {
  const a = AUTHORITY[authority];
  return `You are the ${a.name} for Giftwise, which helps families pay bills for someone who receives SSI.
You may rely only on the passages given to you from ${a.reads}. Do not use any other knowledge of SSI rules, and do not guess at rules your passages do not contain.
The question: when someone other than the SSI recipient pays this bill directly to the business, is it a shelter cost (a housing cost that counts as in-kind support and maintenance), or not?
Answer "unclear" if your passages do not settle it. Never compute benefit amounts: Giftwise's rules engine does that.`;
}

/** One reviewer, one authority. */
export async function review(authority: AuthorityId, c: ReviewCase): Promise<Review & { model: string }> {
  const passages = passagesFor(authority)
    .map((p) => `[${p.id}] ${p.cite}${p.section_heading ? `, ${p.section_heading}` : ""}\n${p.text}`)
    .join("\n\n");
  const { data, model } = await structured({
    schema: schemaFor(authority),
    system: systemFor(authority),
    effort: "medium",
    maxTokens: 8000,
    content: [
      { type: "text", text: `Your rulebook passages:\n\n${passages}` },
      asData("bill", `${c.description}\nAmount: $${c.gift.amount.toFixed(2)}${c.gift.recurring ? ", paid every month" : ""}`),
      { type: "text", text: "Is this bill a shelter cost under your passages? Quote the passage that decides it." },
    ],
  });
  return { authority, ...data, model };
}

/** Both reviewers in parallel, then the referee, then the rules engine. */
export async function runReviewers(c: ReviewCase, profile: Profile = DEFAULT_PROFILE) {
  const started = Date.now();
  const [regs, poms] = await Promise.all([review("regs", c), review("poms", c)]);
  const ref = referee([regs, poms]);
  const route = routeForDecision(c.gift, ref.decision, profile);
  return { reviews: [regs, poms], ...ref, outcome: route, model: regs.model, ms: Date.now() - started };
}

/** The public shape of a run: the API response, and the recorded examples. */
export function reviewPayload(run: Awaited<ReturnType<typeof runReviewers>>) {
  return {
    reviews: run.votes.map((v) => ({
      authority: v.authority,
      answer: v.answer,
      passage_id: v.passage_id,
      cite: v.passage?.cite ?? null,
      url: v.passage?.url ?? null,
      quote: v.quote,
      quote_checked: v.valid,
      set_aside_reason: v.setAsideReason ?? null,
      reason: { plain: v.reason_plain, technical: v.reason_technical },
      confidence: v.confidence,
    })),
    referee: { decision: run.decision, agreed: run.agreed, summary: run.summary },
    outcome: { route: run.outcome.route, check_after: run.outcome.check, readings: run.outcome.readings, routes: run.outcome.routes, rule_ids: run.outcome.ruleIds },
  };
}
