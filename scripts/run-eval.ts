// Evaluation: labeled bills in two sets, the first 20 (content/eval/bills.json) and a harder set of costs near the line
// (content/eval/bills-hard.json). Each bill goes to three setups:
//   1. Claude alone with no rulebook: given only the bill, it decides shelter or not and picks a route (the obvious alternative);
//   2. each reviewer alone, reading only its own rulebook and quoting it;
//   3. both reviewers and the referee.
// Scored on (a) accuracy where the rules are clear and (b) the negative control: a route accepted that lowers her check
// under the true reading. Writes content/eval-results.json, which the Evidence page shows.
// Usage: npx tsx --env-file=.env.local scripts/run-eval.ts             (all calls; set EVAL_CACHE=<file> to resume a run)
//        npx tsx --env-file=.env.local scripts/run-eval.ts --rescore   (no API calls: re-score the recorded answers)
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import first from "../content/eval/bills.json";
import hard from "../content/eval/bills-hard.json";
import { AiRefusedError, MODEL, asData, structured } from "../src/lib/ai/claude";
import { review } from "../src/lib/ai/reviewers";
import { checkVote, referee, routeForDecision, type Answer, type AuthorityId, type Decision, type Review } from "../src/lib/review/referee";
import { DEFAULT_PROFILE, SHELTER_CATEGORIES, evaluateGift, type Category, type Gift } from "../src/lib/rules";

type Truth = "shelter" | "not_shelter" | "contested";
type SetId = "first" | "hard";
type Case = { id: string; description: string; category: string; truth: Truth; basis: string; set: SetId };
const CASES: Case[] = [
  ...(first.cases as Omit<Case, "set">[]).map((c) => ({ ...c, set: "first" as const })),
  ...(hard.cases as Omit<Case, "set">[]).map((c) => ({ ...c, set: "hard" as const })),
];
const OUT = "content/eval-results.json";
const AMOUNT = 150;
const SETUPS = ["baseline", "regs", "poms", "referee"] as const;
type Setup = (typeof SETUPS)[number];
type Route = "vendor" | "able";

/** The categories the truth allows: one for a clear case, both readings for a contested one. */
function truthReadings(c: Case): Category[] {
  const cat = c.category as Category;
  if (c.truth !== "contested") return [cat];
  return [SHELTER_CATEGORIES.includes(cat) ? cat : "utility", "other"];
}

/** The check under the true reading for a route; for a contested case, the worse of the two readings. */
function checkUnderTruth(c: Case, gift: Gift, route: Route | null) {
  if (!route) return null;
  return Math.min(...truthReadings(c).map((category) => evaluateGift({ ...gift, delivery: route, category }, DEFAULT_PROFILE).checkAfter));
}

const single = (r: Review): Decision => {
  const v = checkVote(r);
  return v.valid && r.answer !== "unclear" ? (r.answer as Decision) : "unsure";
};

// ---- The no-rulebook baseline: Claude alone, given only the bill text. ----
const BaselineAnswer = z.object({
  answer: z
    .enum(["shelter", "not_shelter", "unclear"])
    .describe("shelter: a housing cost that counts as in-kind support and maintenance when someone else pays it. not_shelter: anything else. unclear: you cannot tell."),
  route: z.enum(["vendor", "able"]).describe("vendor: pay the business directly. able: put the money in her ABLE account so she pays the bill herself."),
  reason: z.string().describe("Under 30 words."),
});
const BASELINE_SYSTEM = [
  "You help families pay bills for a woman who receives Supplemental Security Income (SSI). She lives alone, is eligible for an ABLE account, and has no other income.",
  "When a relative pays one of her bills, Giftwise can pay the business directly, or put the money in her ABLE account so she pays the bill herself.",
  "Decide whether the bill is a shelter cost (a housing cost that counts as in-kind support and maintenance when someone else pays it), then pick the route that keeps her monthly SSI check whole.",
  "Paying the business directly is simpler for the family, so choose it unless it would lower her check. Answer from your own knowledge of the SSI rules; no documents are provided.",
].join(" ");

type BaselineRaw = z.infer<typeof BaselineAnswer>;
type ReviewRaw = Review & { model?: string };
type Raw = { baseline: BaselineRaw | null; regs: ReviewRaw | null; poms: ReviewRaw | null };

async function baselineCall(c: Case): Promise<BaselineRaw> {
  const { data } = await structured({
    schema: BaselineAnswer,
    system: BASELINE_SYSTEM,
    effort: "medium",
    maxTokens: 8000,
    content: [asData("bill", `${c.description}\nAmount: $${AMOUNT.toFixed(2)}`), { type: "text", text: "Is this bill a shelter cost, and which route keeps her check whole?" }],
  });
  return data;
}

/** A call that failed or was refused counts as an abstention, never a guess. Failed calls are not cached, so a rerun retries them. */
const unclearReview = (authority: AuthorityId): ReviewRaw => ({ authority, answer: "unclear", passage_id: "", quote: "", reason_plain: "No answer.", reason_technical: "", confidence: 0 });

async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries || e instanceof AiRefusedError) throw e;
      await new Promise((r) => setTimeout(r, 5000 * i));
    }
  }
}

// ---- Cache of raw answers, so an interrupted run resumes without paying twice. ----
const CACHE = process.env.EVAL_CACHE;
const cache: Record<string, Raw> = (() => {
  if (!CACHE) return {};
  try {
    return JSON.parse(readFileSync(CACHE, "utf8"));
  } catch {
    return {};
  }
})();
const saveCache = () => CACHE && writeFileSync(CACHE, JSON.stringify(cache));

let calls = 0;
async function answersFor(c: Case): Promise<Raw> {
  const key = `${c.set}/${c.id}`;
  const got: Raw = cache[key] ?? { baseline: null, regs: null, poms: null };
  const gift: Gift = { id: c.id, date: "2026-04-10", amount: AMOUNT, delivery: "vendor", category: c.category as Category };
  const tasks: Promise<void>[] = [];
  if (!got.baseline)
    tasks.push(
      withRetry(() => (calls++, baselineCall(c)))
        .then((r) => void (got.baseline = r))
        .catch((e) => console.error(`${key} baseline: ${(e as Error).message}`)),
    );
  for (const a of ["regs", "poms"] as const)
    if (!got[a])
      tasks.push(
        withRetry(() => (calls++, review(a, { description: c.description, gift })))
          .then((r) => void (got[a] = r))
          .catch((e) => console.error(`${key} ${a}: ${(e as Error).message}`)),
      );
  await Promise.all(tasks);
  cache[key] = got;
  saveCache();
  return got;
}

// ---- Scoring ----
function score(c: Case, raw: Raw) {
  const gift: Gift = { id: c.id, date: "2026-04-10", amount: AMOUNT, delivery: "vendor", category: c.category as Category };
  const full = evaluateGift({ ...gift, delivery: "able" }, DEFAULT_PROFILE).checkBaseline;
  const regs = raw.regs ?? unclearReview("regs");
  const poms = raw.poms ?? unclearReview("poms");
  const ref = referee([regs, poms]);
  const b = raw.baseline;
  const decided: Record<Setup, { decision: Decision; route: Route | null }> = {
    baseline: { decision: !b || b.answer === "unclear" ? "unsure" : b.answer, route: b?.route ?? null },
    regs: { decision: single(regs), route: routeForDecision(gift, single(regs)).route as Route | null },
    poms: { decision: single(poms), route: routeForDecision(gift, single(poms)).route as Route | null },
    referee: { decision: ref.decision, route: routeForDecision(gift, ref.decision).route as Route | null },
  };
  const outcome = Object.fromEntries(
    SETUPS.map((k) => {
      const { decision, route } = decided[k];
      const check = checkUnderTruth(c, gift, route);
      return [k, { decision, route, check, safe: check === full, correct: c.truth === "contested" ? null : decision === c.truth }];
    }),
  ) as Record<Setup, { decision: Decision; route: Route | null; check: number | null; safe: boolean; correct: boolean | null }>;
  const vote = (r: Review) => {
    const v = checkVote(r);
    return { answer: r.answer as Answer, passage: r.passage_id, cite: v.passage?.cite ?? null, quote: r.quote, quote_checked: v.valid, reason: r.reason_plain };
  };
  const row = {
    id: c.id,
    set: c.set,
    description: c.description,
    category: c.category,
    truth: c.truth,
    basis: c.basis,
    baseline: b ? { answer: b.answer, route: b.route, reason: b.reason } : null,
    regs: vote(regs),
    poms: vote(poms),
    agreed: ref.agreed,
    outcome,
  };
  const o = row.outcome;
  console.log(
    `${c.id.padEnd(26)} ${c.truth.padEnd(11)} base ${o.baseline.decision.padEnd(11)} regs ${o.regs.decision.padEnd(11)} poms ${o.poms.decision.padEnd(11)} ref ${o.referee.decision.padEnd(11)} ` +
      SETUPS.filter((k) => !o[k].safe).map((k) => `UNSAFE:${k}`).join(" "),
  );
  return row;
}
type Row = ReturnType<typeof score>;

function summarize(rows: Row[], key: Setup) {
  const clear = rows.filter((r) => r.truth !== "contested");
  return {
    clear_cases: clear.length,
    correct: clear.filter((r) => r.outcome[key].correct === true).length,
    wrong: clear.filter((r) => r.outcome[key].decision !== "unsure" && r.outcome[key].correct === false).length,
    abstained: clear.filter((r) => r.outcome[key].decision === "unsure").length,
    all_cases: rows.length,
    check_kept_whole: rows.filter((r) => r.outcome[key].safe).length,
    /** The negative control: a route accepted that lowers her check under the true reading. */
    wrong_routes_accepted: rows.filter((r) => !r.outcome[key].safe).length,
    wrong_route_ids: rows.filter((r) => !r.outcome[key].safe).map((r) => r.id),
  };
}

function summaries(rows: Row[]) {
  return Object.fromEntries(SETUPS.map((k) => [k, summarize(rows, k)])) as Record<Setup, ReturnType<typeof summarize>>;
}

function negativeControl(rows: Row[]) {
  const quotes = rows.flatMap((r) => [r.regs, r.poms]);
  // A disagreement: the referee had no shared, checked reading to act on.
  const unsure = rows.filter((r) => r.outcome.referee.decision === "unsure");
  const counted = (v: Row["regs"]) => v.quote_checked && v.answer !== "unclear";
  const wrong = (filter: (r: Row) => boolean) =>
    Object.fromEntries(SETUPS.map((k) => [k, rows.filter((r) => filter(r) && !r.outcome[k].safe).length])) as Record<Setup, number>;
  return {
    bills: rows.length,
    clear_bills: rows.filter((r) => r.truth !== "contested").length,
    contested_bills: rows.filter((r) => r.truth === "contested").length,
    /** A route accepted that lowers her check under the true reading (for a contested bill, under either reading). */
    wrong_routes_accepted: wrong(() => true),
    wrong_routes_on_clear_bills: wrong((r) => r.truth !== "contested"),
    wrong_routes_on_contested_bills: wrong((r) => r.truth === "contested"),
    disagreements_total: unsure.length,
    disagreements_sent_to_safe_route: unsure.filter((r) => r.outcome.referee.safe).length,
    disagreement_kinds: {
      opposite_answers: unsure.filter((r) => counted(r.regs) && counted(r.poms) && r.regs.answer !== r.poms.answer).length,
      one_reviewer_unsettled: unsure.filter((r) => [r.regs, r.poms].filter((v) => v.quote_checked && v.answer === "unclear").length === 1).length,
      both_reviewers_unsettled: unsure.filter((r) => r.regs.answer === "unclear" && r.poms.answer === "unclear").length,
      quote_set_aside: unsure.filter((r) => !r.regs.quote_checked || !r.poms.quote_checked).length,
    },
    quotes_checked: quotes.filter((q) => q.quote_checked).length,
    quotes_total: quotes.length,
  };
}

async function main() {
  const started = Date.now();
  const rescore = process.argv.includes("--rescore");
  const previous = rescore ? JSON.parse(readFileSync(OUT, "utf8")) : null;
  const rows: Row[] = [];
  if (rescore) {
    for (const c of CASES) {
      const p = previous.cases.find((x: { id: string; set?: SetId }) => x.id === c.id && (x.set ?? "first") === c.set);
      if (!p) throw new Error(`No recorded answers for ${c.set}/${c.id}; run without --rescore.`);
      const rebuild = (authority: AuthorityId, v: { answer: Answer; passage: string; quote?: string; reason: string }): Review => ({
        authority,
        answer: v.answer,
        passage_id: v.passage,
        quote: v.quote ?? "",
        reason_plain: v.reason,
        reason_technical: "",
        confidence: 0,
      });
      rows.push(score(c, { baseline: p.baseline, regs: rebuild("regs", p.regs), poms: rebuild("poms", p.poms) }));
    }
  } else {
    const BATCH = 5;
    for (let i = 0; i < CASES.length; i += BATCH) {
      const batch = CASES.slice(i, i + BATCH);
      const raws = await Promise.all(batch.map(answersFor));
      rows.push(...batch.map((c, j) => score(c, raws[j])));
    }
  }
  const all = negativeControl(rows);
  const result = {
    ran_at: rescore ? previous.ran_at : new Date().toISOString(),
    rescored_at: rescore ? new Date().toISOString() : null,
    model: MODEL,
    amount: AMOUNT,
    quotes_checked: all.quotes_checked,
    quotes_total: all.quotes_total,
    /** All bills, both sets. */
    summary: summaries(rows),
    sets: {
      first: { label: "First 20 bills", bills: rows.filter((r) => r.set === "first").length, summary: summaries(rows.filter((r) => r.set === "first")), negative_control: negativeControl(rows.filter((r) => r.set === "first")) },
      hard: { label: "Harder bills, near the line", bills: rows.filter((r) => r.set === "hard").length, summary: summaries(rows.filter((r) => r.set === "hard")), negative_control: negativeControl(rows.filter((r) => r.set === "hard")) },
    },
    negative_control: all,
    api_calls: rescore ? (previous.api_calls ?? null) : calls,
    cases: rows,
    ms: rescore ? (previous.ms ?? null) : Date.now() - started,
  };
  writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
  console.log("\n", JSON.stringify(result.negative_control, null, 1));
  for (const k of SETUPS) {
    const s = result.summary[k];
    console.log(`${k.padEnd(9)} right ${s.correct}/${s.clear_cases}  wrong ${s.wrong}  unsettled ${s.abstained}  wrong routes ${s.wrong_routes_accepted}/${s.all_cases}  ${s.wrong_route_ids.join(",")}`);
  }
  console.log(`API calls this run: ${result.api_calls ?? 0}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
