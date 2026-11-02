// Record a live review for each example bill, so its page shows the reviewers without waiting.
// Usage: npx tsx --env-file=.env.local scripts/record-reviews.ts [preset-id]
import { writeFileSync } from "node:fs";
import { reviewPayload, runReviewers } from "../src/lib/ai/reviewers";
import { getPreset } from "../src/lib/presets";

const CASES: Record<string, string> = {
  "electric-bill": "Northside Electric Co-op (sample). Monthly bill for residential electric service at her apartment.",
};

async function main() {
  const ids = process.argv[2] ? [process.argv[2]] : Object.keys(CASES);
  for (const id of ids) {
    const g = getPreset(id)?.gift;
    if (!g || !CASES[id]) throw new Error(`No reviewable bill for ${id}`);
    const input = { description: CASES[id], amount: g.amount, category: g.category, date: g.date, recurring: g.recurring };
    const run = await runReviewers({ description: input.description, gift: { id, ...g } });
    const out = { recorded_at: new Date().toISOString(), model: run.model, input, data: reviewPayload(run) };
    writeFileSync(`content/reviews/${id}.json`, JSON.stringify(out, null, 2) + "\n");
    console.log(id, run.decision, run.summary, "|", out.data.reviews.map((r) => `${r.authority}: ${r.answer}, quote ${r.quote_checked ? "checked" : "set aside"}`).join("; "), `| ${run.ms} ms`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
