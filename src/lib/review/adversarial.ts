import { AUTHORITY, PASSAGES, referee, routeForDecision, type AuthorityId, type Review } from "./referee";
import { usd, type Gift } from "@/lib/rules";

/**
 * A recorded adversarial set for the referee, built in code against the real rulebook passages (content/authorities.json),
 * with no model call: reviewer outputs a model could plausibly send and must not be trusted, and what the referee does
 * with each. Shown on /evidence/rules#referee and held by tests/referee-adversarial.test.ts.
 *
 * The bill is the sample page's electric bill: $138 a month, paid by family, in April 2026. Under a "housing cost"
 * reading, paying the company lowers her June check; paid into her ABLE account it stays whole under either reading.
 */
export const ADVERSARIAL_BILL: Gift = { id: "adversarial-electric", date: "2026-04-10", amount: 138, delivery: "vendor", category: "utility", recurring: true };

const passage = (id: string) => {
  const p = PASSAGES.find((x) => x.id === id);
  if (!p) throw new Error(`content/authorities.json has no passage ${id}`);
  return p;
};
/** A word-for-word quote from a passage: its first `words` words. */
const quoteFrom = (id: string, words = 14) => passage(id).text.replace(/\s+/g, " ").trim().split(" ").slice(0, words).join(" ");

const REGS_SHELTER = "cfr-416-1130-shelter";
const POMS_HOUSEHOLD_COSTS = "poms-si-00835-465-household-costs-list";

const review = (authority: AuthorityId, answer: Review["answer"], passage_id: string, quote: string, reason: string): Review => ({
  authority,
  answer,
  passage_id,
  quote,
  reason_plain: reason,
  reason_technical: reason,
  confidence: 0.9,
});

/** The honest pair both reviewers send on this bill: each quotes its own rulebook, word for word, and both say housing. */
const regsHonest = review("regs", "shelter", REGS_SHELTER, quoteFrom(REGS_SHELTER), "The regulation lists electricity among shelter.");
const pomsHonest = review("poms", "shelter", POMS_HOUSEHOLD_COSTS, quoteFrom(POMS_HOUSEHOLD_COSTS), "The manual lists electricity among household costs.");

export type AdversarialCase = {
  id: string;
  /** What the reviewer sent that must not be trusted. */
  sent: string;
  /** The reviews as the model would have returned them. */
  reviews: Review[];
  /** What the referee is expected to do. */
  expect: { decision: "shelter" | "not_shelter" | "unsure"; setAside: number; route: "able" | "vendor" };
};

export const ADVERSARIAL: AdversarialCase[] = [
  {
    id: "control",
    sent: "Both reviewers quote their own rulebook word for word and agree: a housing cost.",
    reviews: [regsHonest, pomsHonest],
    expect: { decision: "shelter", setAside: 0, route: "able" },
  },
  {
    id: "wrong-quote",
    sent: "The manual reviewer's quote is not in the passage it cites: a sentence the model wrote itself.",
    reviews: [regsHonest, review("poms", "not_shelter", POMS_HOUSEHOLD_COSTS, "Electric bills paid by a relative are never counted as household costs for SSI.", "Family-paid utilities are excluded.")],
    expect: { decision: "unsure", setAside: 1, route: "able" },
  },
  {
    id: "wrong-rulebook",
    sent: "The regulations reviewer cites a passage from the manual, the other reviewer's rulebook, with a real quote from it.",
    reviews: [review("regs", "not_shelter", POMS_HOUSEHOLD_COSTS, quoteFrom(POMS_HOUSEHOLD_COSTS), "The manual settles it."), pomsHonest],
    expect: { decision: "unsure", setAside: 1, route: "able" },
  },
  {
    id: "fabricated-citation",
    sent: "The right answer (a housing cost) with a citation that does not exist in either rulebook.",
    reviews: [review("regs", "shelter", "cfr-416-1130-z-utilities", quoteFrom(REGS_SHELTER), "Section (z) covers utilities."), pomsHonest],
    expect: { decision: "unsure", setAside: 1, route: "able" },
  },
  {
    id: "disagree",
    sent: "Both quotes check out and the answers differ: housing from the regulations, not housing from the manual.",
    reviews: [regsHonest, { ...pomsHonest, answer: "not_shelter", reason_plain: "Read as an ordinary bill.", reason_technical: "Read as an ordinary bill." }],
    expect: { decision: "unsure", setAside: 0, route: "able" },
  },
];

export type AdversarialRow = AdversarialCase & {
  decision: ReturnType<typeof referee>;
  routed: ReturnType<typeof routeForDecision>;
  /** Her June check if the company were paid under the housing reading, and with the route the referee's code took. */
  ifPaidShop: number;
  check: number;
  checkWhole: boolean;
  /** The sentence the table shows: what the referee did. */
  did: string;
};

/** Run every case through the same referee() and routeForDecision() the API uses. */
export function runAdversarial(): AdversarialRow[] {
  const whole = routeForDecision(ADVERSARIAL_BILL, "not_shelter").check as number;
  return ADVERSARIAL.map((c) => {
    const decision = referee(c.reviews);
    const routed = routeForDecision(ADVERSARIAL_BILL, decision.decision);
    const shop = routeForDecision(ADVERSARIAL_BILL, "shelter").routes.find((r) => r.delivery === "vendor")!;
    const setAside = decision.votes.filter((v) => !v.valid);
    const who = (v: Review) => AUTHORITY[v.authority].name.toLowerCase();
    const did = decision.agreed
      ? `Both quotes found word for word; acts on the reading. ${decision.decision === "shelter" ? "A housing cost" : "Not a housing cost"}, so ${routed.route === "able" ? "her ABLE account" : "the company"} is paid.`
      : setAside.length
        ? `Sets aside the ${setAside.map((v) => who(v)).join(" and ")}: ${setAside.map((v) => v.setAsideReason?.replace(/^It(s?) /, "it$1 ").replace(/\.$/, "")).join("; ")}. Abstains, and routes the bill the way that keeps her check whole under either reading.`
        : "Both quotes check out and the answers differ, so neither reading is acted on. Abstains, and routes the bill the way that keeps her check whole under either reading.";
    return { ...c, decision, routed, ifPaidShop: shop.check, check: routed.check as number, checkWhole: routed.check === whole, did };
  });
}

/** The bill in one line, for the table's caption. */
export const ADVERSARIAL_BILL_LINE = `${usd(ADVERSARIAL_BILL.amount)} electric bill, paid by family in April 2026`;
