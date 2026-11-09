import results from "../../../content/eval-results.json";
import { DEFAULT_PROFILE, SHELTER_CATEGORIES, evaluateGift, type Category, type Gift } from "@/lib/rules";
import { routeForDecision } from "./referee";

/**
 * What the AI adds, measured on the recorded run (content/eval-results.json), with no model call. Beside each reviewer
 * alone and the referee stands a router with no AI at all: it never reads the bill and always takes the route that keeps
 * her check whole under both readings (routeForDecision with "unsure", the referee's own fallback). Every setup is scored
 * the way scripts/run-eval.ts scores it, against the bill's true label, at the run's amount and date.
 *
 * Three measures: her check kept whole; wrong routes accepted (a route that lowers her check under the true reading);
 * and bills settled with nothing left for her to do, meaning paid straight to the business. A bill sent to her ABLE
 * account keeps the check whole too, but she then pays it herself, and it needs an ABLE account and its yearly room.
 */
type Truth = "shelter" | "not_shelter" | "contested";
type Route = "vendor" | "able" | null;
type Outcome = { route: Route; safe: boolean };
type Case = { id: string; category: string; truth: Truth; outcome: Record<"baseline" | "regs" | "poms" | "referee", Outcome> };

const R = results as unknown as { amount: number; cases: Case[] };
/** The date scripts/run-eval.ts scores every bill on. */
const DATE = "2026-04-10";

/** The check under the true label: for a contested bill, the worse of the two readings (as scripts/run-eval.ts). */
function checkUnderTruth(gift: Gift, truth: Truth, route: Route) {
  if (!route) return null;
  const cat = gift.category;
  const readings: Category[] = truth === "contested" ? [SHELTER_CATEGORIES.includes(cat) ? cat : "utility", "other"] : [cat];
  return Math.min(...readings.map((category) => evaluateGift({ ...gift, delivery: route, category }, DEFAULT_PROFILE).checkAfter));
}

/** The router with no AI, case by case: the both-readings route and whether it keeps her check whole under the truth. */
export function noAiOutcomes(): (Outcome & { id: string })[] {
  return R.cases.map((c) => {
    const gift: Gift = { id: c.id, date: DATE, amount: R.amount, delivery: "vendor", category: c.category as Category };
    const full = evaluateGift({ ...gift, delivery: "able" }, DEFAULT_PROFILE).checkBaseline;
    const route = routeForDecision(gift, "unsure").route as Route;
    return { id: c.id, route, safe: checkUnderTruth(gift, c.truth, route) === full };
  });
}

export type Column = { id: "none" | "regs" | "poms" | "referee"; label: string; whole: number; wrong: number; direct: number };

/** One column per setup: the router with no AI, each reviewer alone, then the referee. */
export function whatAiAdds() {
  const none = noAiOutcomes();
  const col = (id: Column["id"], label: string, rows: Outcome[]): Column => ({
    id,
    label,
    whole: rows.filter((o) => o.safe).length,
    wrong: rows.filter((o) => !o.safe).length,
    direct: rows.filter((o) => o.safe && o.route === "vendor").length,
  });
  const columns: Column[] = [
    col("none", "No AI: always the route safe under both readings", none),
    col("regs", "Regulations reviewer alone", R.cases.map((c) => c.outcome.regs)),
    col("poms", "Manual reviewer alone", R.cases.map((c) => c.outcome.poms)),
    col("referee", "Both reviewers and the referee", R.cases.map((c) => c.outcome.referee)),
  ];
  return {
    bills: R.cases.length,
    /** Bills whose true label is not housing: the ones that can be paid straight to the business. */
    payable: R.cases.filter((c) => c.truth === "not_shelter").length,
    columns,
  };
}

/** The finding in plain words, built from the numbers so it states whatever the run shows. */
export function whatAiAddsSentence() {
  const t = whatAiAdds();
  const [none, , , ref] = t.columns;
  const sameSafety = none.whole === ref.whole && none.wrong === ref.wrong;
  return [
    `With no AI, always taking the route that is safe under both readings keeps her check whole on ${none.whole} of ${t.bills} bills with ${none.wrong} wrong ${none.wrong === 1 ? "route" : "routes"}${sameSafety ? ", the same as the referee: on these bills the AI does not make the check safer" : `; the referee keeps it whole on ${ref.whole} with ${ref.wrong}`}.`,
    `What the AI adds is settling bills: the referee pays ${ref.direct} of the ${t.payable} bills that are not housing straight to the business, with nothing left for her to do, while the router with no AI pays ${none.direct} that way and sends ${t.bills - none.direct} to her ABLE account, where she pays each bill herself.`,
  ].join(" ");
}
