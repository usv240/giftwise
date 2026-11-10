// Record Claude's reading of the sample letter (public/samples/sam-ssa-letter-sample.png and .pdf), once per file, for
// the replay set: with no AI key, or once the day's AI budget is spent, the "Read her letter" step answers the sample
// from these, labelled Replayed. One Claude call per file; pass png or pdf to record only one.
// Then run `npx tsx scripts/build-ai-replay.ts` to rebuild content/ai-replay.
// Usage: npx tsx --env-file=.env.local scripts/record-letter-read.ts [png|pdf]
import { writeFileSync } from "node:fs";
import { costOf } from "../src/lib/ai/claude";
import { readLetter } from "../src/lib/ai/letter";
import { sampleLetterFile, type SampleLetterKind } from "../src/lib/ai/sample-letter";

async function main() {
  const kinds = (process.argv[2] ? [process.argv[2]] : ["pdf", "png"]) as SampleLetterKind[];
  let spent = 0;
  for (const kind of kinds) {
    const { prepared } = await sampleLetterFile(kind);
    const t = Date.now();
    const r = await readLetter(prepared);
    if (r.replayed) throw new Error(`The ${kind} reading came from a recording, not a live call: nothing to record.`);
    const ms = Date.now() - t;
    const cost = costOf(r.usage as Parameters<typeof costOf>[0]);
    spent += cost;
    writeFileSync(`content/reviews/ssa-letter-read-${kind}.json`, JSON.stringify({ recorded_at: new Date().toISOString(), model: r.model, ms, data: r.data }, null, 2) + "\n");
    console.log(`${kind}: $${r.data.ssi_payment.amount} for ${r.data.ssi_payment.month}, ${r.data.other_income.length} income lines (${ms} ms, $${cost.toFixed(4)})`);
  }
  console.log(`Claude spend for this recording: $${spent.toFixed(4)}`);
}
void main();
