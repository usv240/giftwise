// Write content/ai-replay: Claude's recorded answers for the samples a visitor can run (the sample electric bill read,
// the two reviewers on that bill, the sample fundraiser), each keyed by the request the current code sends
// (src/lib/ai/replay-set.ts). With no AI key, or once the day's budget is spent, src/lib/ai/claude.ts
// answers exactly those requests from here, so the reader, the reviewers, the quote check, the referee and the rules
// engine all run as they do live. No model call: the answers come from the recordings named in each file's `source`.
// When a prompt, schema or passage changes, record the sample again first (scripts/record-bill-read.ts for the bill;
// the API docs recording for the reviewers and the fundraiser), then run this.
// Usage: npx tsx scripts/build-ai-replay.ts
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { REPLAY_DIR } from "../src/lib/ai/claude";
import { replayEntries } from "../src/lib/ai/replay-set";

async function main() {
  const entries = await replayEntries();
  mkdirSync(REPLAY_DIR, { recursive: true });
  for (const f of readdirSync(REPLAY_DIR)) if (f.endsWith(".json")) rmSync(path.join(REPLAY_DIR, f));
  for (const e of entries) {
    const file = { what: e.what, source: e.source, recorded_at: e.recorded_at, model: e.model, stop_reason: "end_turn", usage: null, parsed_output: e.parsed_output };
    writeFileSync(path.join(REPLAY_DIR, `${e.key}.json`), JSON.stringify(file, null, 2) + "\n");
    console.log(`${e.key.slice(0, 12)}  ${e.what}`);
  }
  console.log(`\n${entries.length} recorded answers in ${path.relative(process.cwd(), REPLAY_DIR)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
