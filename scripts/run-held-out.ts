// The held-out check: worked examples from SSA's own pages that were never scored or used to change the rules engine
// (content/eval/held-out.json), run on the engine frozen at one commit. No model call.
//
// Freeze and run (from the repo root; the engine at the commit is copied out of git, so later edits cannot reach it):
//   git archive <commit> src/lib/rules content/facts.json | tar -x -C <empty dir>
//   npx tsx scripts/run-held-out.ts --engine <empty dir> --commit <commit>
// Writes content/eval/held-out-results.json. tests/held-out.test.ts reruns the cases on the current engine.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import data from "../content/eval/held-out.json";
import { scoreHeldOut } from "../src/lib/held-out";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const dir = arg("engine");
const commit = arg("commit");
if (!dir || !commit) throw new Error("Usage: npx tsx scripts/run-held-out.ts --engine <dir with the frozen src/lib/rules> --commit <commit>");

/** A hash of the frozen engine's files, so the record names exactly what ran. */
function treeHash(root: string) {
  const h = createHash("sha256");
  const files = [...readdirSync(path.join(root, "src/lib/rules")).map((f) => path.join("src/lib/rules", f)), "content/facts.json"].sort();
  for (const f of files) h.update(f).update(readFileSync(path.join(root, f)));
  return h.digest("hex").slice(0, 16);
}

async function main() {
const rules = await import(pathToFileURL(path.resolve(dir!, "src/lib/rules/index.ts")).href);
const scored = scoreHeldOut(data.cases as never, rules);
const gitTree = execFileSync("git", ["rev-parse", `${commit!}:src/lib/rules`], { encoding: "utf8" }).trim();
const out = {
  ran_at: new Date().toISOString(),
  engine: { commit: commit!.slice(0, 7), git_tree_src_lib_rules: gitTree, files_sha256: treeHash(dir!), rules_version: rules.RULES_VERSION },
  source: "content/eval/held-out.json",
  summary: {
    cases: scored.length,
    engine_matches: scored.filter((c) => c.match).length,
    counts_matches: scored.filter((c) => c.counts_match).length,
    misses: scored.filter((c) => !c.match).map((c) => c.id),
    not_scored: data.not_scored.length,
  },
  /** The first run, before the two corrections content/eval/held-out.json records. */
  first_run: { ran_at: "2026-11-08T08:48:49.600Z", engine_matches: 1, cases: 5, counts_matches: 3 },
  cases: scored,
};
writeFileSync("content/eval/held-out-results.json", JSON.stringify(out, null, 2) + "\n");
console.log(`${out.summary.engine_matches} of ${out.summary.cases} match SSA's answer on the engine at ${out.engine.commit}; misses: ${out.summary.misses.join(", ") || "none"}`);
}
void main();
