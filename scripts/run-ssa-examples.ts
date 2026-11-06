// Social Security's own worked examples (content/eval/ssa-examples.json), answered two ways:
//   1. the Giftwise rules engine, from the gifts as entered;
//   2. Claude alone, from the situation in words, with no rulebook and no engine (the obvious alternative).
// Both are scored against SSA's answer. Writes content/eval/ssa-examples-results.json, shown on /evidence.
// Usage: npx tsx --env-file=.env.local scripts/run-ssa-examples.ts            (engine and Claude)
//        npx tsx --env-file=.env.local scripts/run-ssa-examples.ts --engine   (engine only, no API calls)
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import data from "../content/eval/ssa-examples.json";
import { MODEL, structured } from "../src/lib/ai/claude";
import { DEFAULT_PROFILE, P, RULES_VERSION, computeMonth, planMonths, type Gift, type Profile } from "../src/lib/rules";

type Measure = "after_infrequent" | "ism_value" | "ssi_amount";
type Value = { month: string; measure: Measure; value: number };
type Case = Omit<(typeof data.cases)[number], "expected" | "profile"> & { profile?: Partial<Profile>; expected: { counts: boolean; values: Value[] } };
const CASES = data.cases as unknown as Case[];
const TOLERANCE = 1;
const OUT = "content/eval/ssa-examples-results.json";

/** What the rules engine says for each month SSA's answer names. */
function engine(c: Case) {
  const profile: Profile = { ...DEFAULT_PROFILE, ableEligible: true, savings: 0, ...c.profile };
  const plan = planMonths(c.gifts as Gift[], profile);
  const byMonth = new Map(plan.months.map((m) => [m.month, m]));
  const read = (month: string, measure: Measure) => {
    const t = byMonth.get(month);
    if (measure === "ssi_amount") return t?.check ?? computeMonth(month, [], profile).check;
    if (!t) return 0;
    if (measure === "ism_value") return t.ismValue;
    return Math.round((t.cashIncome + t.inKindIncome + t.ismValue - t.infrequentExcluded) * 100) / 100;
  };
  const values = c.expected.values.map((v) => ({ ...v, got: read(v.month, v.measure) }));
  const counts = plan.months.some((m) => m.cashIncome + m.inKindIncome + m.ismValue - m.infrequentExcluded > 0);
  const rules = [...new Set(plan.gifts.flatMap((g) => g.ruleIds))];
  return { counts, values, rules };
}

const Answer = z.object({
  counts_as_income: z.boolean().describe("True if the specific help the question asks about adds any income or in-kind support. Support that would apply anyway, without that help, does not make this true."),
  months: z
    .array(
      z.object({
        month: z.string().describe("YYYY-MM"),
        in_kind_support_value: z.number().describe("In-kind support (housing) charged this month because of the help the question asks about, before any exclusions. 0 if that help adds none."),
        income_after_infrequent_exclusion: z.number().describe("Income from the help the question asks about, this month, after the infrequent or irregular income exclusion and before the $20 general exclusion. 0 if none."),
        ssi_amount: z.number().describe("The federal SSI amount for this month, counting everything in the situation, ignoring the two-month payment lag."),
      }),
    )
    .describe("One entry for each month asked about."),
  reason: z.string().describe("One or two sentences."),
});

const SYSTEM = [
  "You answer questions about how the US Supplemental Security Income (SSI) program counts help a recipient receives.",
  "Answer from your own knowledge of the current federal rules. No documents are provided.",
  `Use these 2026 federal amounts: SSI federal benefit rate $${P.fbrIndividual} a month for an individual; presumed maximum value of in-kind support $${P.pmvIndividual}; one-third reduction $${P.vtrIndividual}.`,
  "Assume no state supplement and no income other than what the situation describes.",
].join(" ");

async function claudeAlone(c: Case) {
  const months = [...new Set(c.expected.values.map((v) => v.month))];
  const { data: a } = await structured({
    schema: Answer,
    system: SYSTEM,
    effort: "medium",
    maxTokens: 8000,
    content: [{ type: "text", text: `${c.situation}\n\n${c.question}\n\nGive an entry for each of these months: ${months.join(", ")}.` }],
  });
  const pick = (month: string, measure: Measure) => {
    const m = a.months.find((x) => x.month === month);
    if (!m) return null;
    return measure === "ism_value" ? m.in_kind_support_value : measure === "ssi_amount" ? m.ssi_amount : m.income_after_infrequent_exclusion;
  };
  return { counts: a.counts_as_income, values: c.expected.values.map((v) => ({ ...v, got: pick(v.month, v.measure) })), reason: a.reason };
}

const matches = (r: { counts: boolean; values: (Value & { got: number | null })[] }, c: Case) =>
  r.counts === c.expected.counts && r.values.every((v) => v.got !== null && Math.abs(v.got - v.value) <= TOLERANCE);

async function main() {
  const withClaude = !process.argv.includes("--engine");
  const previous = (() => {
    try {
      return JSON.parse(readFileSync(OUT, "utf8"));
    } catch {
      return null;
    }
  })();
  const started = Date.now();
  const rows = [];
  for (let i = 0; i < CASES.length; i += 4) {
    const batch = CASES.slice(i, i + 4);
    rows.push(
      ...(await Promise.all(
        batch.map(async (c) => {
          const e = engine(c);
          const ai = withClaude ? await claudeAlone(c) : (previous?.cases?.find((p: { id: string }) => p.id === c.id)?.claude ?? null);
          const row = {
            id: c.id,
            engine: { ...e, match: matches(e, c) },
            claude: ai ? { ...ai, match: matches(ai, c) } : null,
          };
          console.log(`${c.id.padEnd(24)} engine ${row.engine.match ? "match " : "DIFFER"}  claude ${row.claude ? (row.claude.match ? "match " : "DIFFER") : "-"}`);
          return row;
        }),
      )),
    );
  }
  const result = {
    ran_at: new Date().toISOString(),
    rules_version: RULES_VERSION,
    model: withClaude ? MODEL : (previous?.model ?? null),
    claude_ran_at: withClaude ? new Date().toISOString() : (previous?.claude_ran_at ?? null),
    tolerance_usd: TOLERANCE,
    summary: {
      cases: rows.length,
      engine_matches: rows.filter((r) => r.engine.match).length,
      claude_matches: rows.filter((r) => r.claude?.match).length,
      claude_answered: rows.filter((r) => r.claude).length,
      out_of_scope_groups: data.out_of_scope.length,
    },
    cases: rows,
    ms: Date.now() - started,
  };
  writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
  console.log(`\nengine ${result.summary.engine_matches}/${rows.length}, Claude alone ${result.summary.claude_matches}/${result.summary.claude_answered}, ${Math.round(result.ms / 1000)} s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
