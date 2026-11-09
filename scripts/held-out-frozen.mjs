// Run a pre-registered held-out set on the rules engine frozen at one commit, in one command. No model call.
//
//   npm run eval:held-out -- --set content/eval/held-out-3.json              freeze HEAD's engine, run the set once
//   npm run eval:held-out -- --set content/eval/held-out-3.json --commit X   freeze commit X instead
//   npm run eval:held-out -- --set content/eval/held-out-3.json --check      freeze and check the set's shape; score nothing
//
// The set must be committed exactly as it is on disk before it runs, so its results file can name the blob that ran
// (scripts/run-held-out.ts records it). The engine is copied out of git (src/lib/rules and content/facts.json) into an
// empty folder, so nothing edited since that commit can reach the run. The run writes <set>-results.json; it refuses to
// overwrite a results file that already exists, because each set is run once.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const set = arg("set");
const check = process.argv.includes("--check");
if (!set) throw new Error("Usage: npm run eval:held-out -- --set content/eval/held-out-3.json [--commit <commit>] [--check]");
if (set === "content/eval/held-out.json") throw new Error("The first held-out set has its own record; run scripts/run-held-out.ts for it.");

const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();
const commit = git("rev-parse", arg("commit") ?? "HEAD");

// 1. The set: committed, and unchanged since.
const tracked = spawnSync("git", ["ls-files", "--error-unmatch", set], { encoding: "utf8" }).status === 0;
const changed = git("status", "--porcelain", "--", set);
if (!check && (!tracked || changed)) throw new Error(`${set} must be committed exactly as it is before it runs (tracked: ${tracked}, changed: ${changed ? "yes" : "no"}).`);

// 2. The shape: every case names its page, quotes it, and asks only for measures the scorer reads.
const MEASURES = new Set(["after_infrequent", "ism_value", "ssi_amount"]);
const data = JSON.parse(readFileSync(set, "utf8"));
const problems = [];
for (const c of data.cases ?? []) {
  if (!c.id || !c.cite || !/^https:\/\/secure\.ssa\.gov\//.test(c.url ?? "")) problems.push(`${c.id}: id, cite and an SSA url`);
  if (!(c.passage_quotes ?? []).length) problems.push(`${c.id}: passage_quotes`);
  if (!c.ssa_answer) problems.push(`${c.id}: ssa_answer`);
  if (typeof c.expected?.counts !== "boolean" || !(c.expected.values ?? []).length) problems.push(`${c.id}: expected.counts and expected.values`);
  for (const v of c.expected?.values ?? []) if (!MEASURES.has(v.measure) || !/^\d{4}-\d{2}$/.test(v.month) || typeof v.value !== "number") problems.push(`${c.id}: value ${JSON.stringify(v)}`);
  for (const g of c.gifts ?? []) if (!g.id || !/^\d{4}-\d{2}-\d{2}$/.test(g.date) || typeof g.amount !== "number") problems.push(`${c.id}: gift ${JSON.stringify(g)}`);
}
if (!data.cases?.length || problems.length) throw new Error(`The set is not ready:\n${problems.join("\n") || "no cases"}`);
const out = set.replace(/\.json$/, "-results.json");
if (!check && existsSync(out)) throw new Error(`${out} already exists: each set is run once.`);

// 3. Freeze the engine at the commit, into an empty folder.
const dir = mkdtempSync(path.join(tmpdir(), "giftwise-frozen-"));
try {
  const tar = path.join(dir, "engine.tar");
  execFileSync("git", ["archive", "--format=tar", "-o", tar, commit, "src/lib/rules", "content/facts.json"]);
  // Extract from inside the folder with a relative name: GNU tar on Windows reads "C:" in a path as a remote host.
  execFileSync("tar", ["-xf", "engine.tar"], { cwd: dir });
  rmSync(tar);
  if (!existsSync(path.join(dir, "src/lib/rules/index.ts"))) throw new Error("The frozen engine has no src/lib/rules/index.ts.");
  console.log(`${data.cases.length} cases in ${set}; engine frozen at ${commit.slice(0, 7)} in ${dir}.`);
  if (check) {
    console.log("Check only: the set is well formed and the engine froze; nothing was scored.");
  } else {
    // 4. Run it once. The key is blanked: this run calls no model.
    const r = spawnSync("npx", ["tsx", "scripts/run-held-out.ts", "--engine", dir, "--commit", commit, "--set", set], { stdio: "inherit", shell: true, env: { ...process.env, ANTHROPIC_API_KEY: "" } });
    if (r.status !== 0) process.exitCode = r.status ?? 1;
    else console.log(`Wrote ${out}. Commit it as it came out.`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
