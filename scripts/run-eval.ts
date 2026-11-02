// Evaluation: 20 labeled bills (content/eval/bills.json), each reviewed by both reviewers. Scores each reviewer alone and
// the two-reviewer referee on (a) accuracy where the rules are clear and (b) whether the chosen route keeps the check whole
// under the true reading. Writes content/eval-results.json, which the For judges page shows.
// Usage: npx tsx --env-file=.env.local scripts/run-eval.ts
import { writeFileSync } from "node:fs";
import data from "../content/eval/bills.json";
import { MODEL } from "../src/lib/ai/claude";
import { review } from "../src/lib/ai/reviewers";
import { checkVote, referee, routeForDecision, type Decision, type Review } from "../src/lib/review/referee";
import { DEFAULT_PROFILE, SHELTER_CATEGORIES, evaluateGift, type Category, type Gift } from "../src/lib/rules";

type Case = { id: string; description: string; category: string; truth: "shelter" | "not_shelter" | "contested"; basis: string };
const CASES = data.cases as Case[];

/** The categories the truth allows: one for a clear case, both readings for a contested one. */
function truthReadings(c: Case): Category[] {
  const cat = c.category as Category;
  if (c.truth !== "contested") return [cat];
  return [SHELTER_CATEGORIES.includes(cat) ? cat : "utility", "other"];
}

/** The check under the true reading for a route; for a contested case, the worse of the two readings. */
function checkUnderTruth(c: Case, gift: Gift, route: "vendor" | "able" | null) {
  if (!route) return null;
  return Math.min(...truthReadings(c).map((category) => evaluateGift({ ...gift, delivery: route, category }, DEFAULT_PROFILE).checkAfter));
}

const single = (r: Review): Decision => {
  const v = checkVote(r);
  return v.valid && r.answer !== "unclear" ? (r.answer as Decision) : "unsure";
};

async function runCase(c: Case) {
  const gift: Gift = { id: c.id, date: "2026-04-10", amount: 150, delivery: "vendor", category: c.category as Category };
  const baseline = evaluateGift({ ...gift, delivery: "able" }, DEFAULT_PROFILE).checkBaseline;
  const [regs, poms] = await Promise.all([review("regs", { description: c.description, gift }), review("poms", { description: c.description, gift })]);
  const ref = referee([regs, poms]);
  const configs = { regs: single(regs), poms: single(poms), referee: ref.decision };
  const outcome = Object.fromEntries(
    Object.entries(configs).map(([k, decision]) => {
      const route = routeForDecision(gift, decision).route;
      const check = checkUnderTruth(c, gift, route);
      return [k, { decision, route, check, safe: check === baseline, correct: c.truth === "contested" ? null : decision === c.truth }];
    }),
  );
  const vote = (r: Review) => {
    const v = checkVote(r);
    return { answer: r.answer, passage: r.passage_id, cite: v.passage?.cite ?? null, quote_checked: v.valid, reason: r.reason_plain };
  };
  console.log(`${c.id.padEnd(18)} truth ${c.truth.padEnd(11)} regs ${configs.regs.padEnd(11)} poms ${configs.poms.padEnd(11)} referee ${configs.referee.padEnd(11)} safe ${outcome.referee.safe}`);
  return { id: c.id, description: c.description, truth: c.truth, basis: c.basis, regs: vote(regs), poms: vote(poms), outcome };
}

function summarize(rows: Awaited<ReturnType<typeof runCase>>[], key: "regs" | "poms" | "referee") {
  const clear = rows.filter((r) => r.truth !== "contested");
  return {
    clear_cases: clear.length,
    correct: clear.filter((r) => r.outcome[key].correct === true).length,
    wrong: clear.filter((r) => r.outcome[key].decision !== "unsure" && r.outcome[key].correct === false).length,
    abstained: clear.filter((r) => r.outcome[key].decision === "unsure").length,
    all_cases: rows.length,
    check_kept_whole: rows.filter((r) => r.outcome[key].safe).length,
  };
}

async function main() {
  const started = Date.now();
  const rows: Awaited<ReturnType<typeof runCase>>[] = [];
  for (let i = 0; i < CASES.length; i += 4) rows.push(...(await Promise.all(CASES.slice(i, i + 4).map(runCase))));
  const quotes = rows.flatMap((r) => [r.regs, r.poms]);
  const result = {
    ran_at: new Date().toISOString(),
    model: MODEL,
    amount: 150,
    quotes_checked: quotes.filter((q) => q.quote_checked).length,
    quotes_total: quotes.length,
    summary: { regs: summarize(rows, "regs"), poms: summarize(rows, "poms"), referee: summarize(rows, "referee") },
    cases: rows,
    ms: Date.now() - started,
  };
  writeFileSync("content/eval-results.json", JSON.stringify(result, null, 2) + "\n");
  console.log("\n", JSON.stringify(result.summary, null, 1), `\nquotes checked ${result.quotes_checked}/${result.quotes_total}, ${Math.round(result.ms / 1000)} s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
