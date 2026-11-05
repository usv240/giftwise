/**
 * The full invariant run: random gifts through the router, each held to every promise in src/lib/invariants.ts.
 * npx tsx scripts/run-invariants.ts [gifts] writes content/eval/invariants-results.json (add --dry to only print).
 * --seed=N draws a different set of random gifts; CI passes its run number, so every run checks gifts no run has seen.
 */
import { writeFileSync } from "node:fs";
import { runInvariants } from "../src/lib/invariants";

const gifts = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 100_000);
const seedArg = process.argv.find((a) => a.startsWith("--seed="));
const seed = seedArg ? Number(seedArg.slice(7)) : undefined;
const t0 = Date.now();
const run = runInvariants(gifts, seed);
const ms = Date.now() - t0;
for (const r of run.results) console.log(`${r.id.padEnd(14)} kept ${r.kept}  broken ${r.broken}`);
console.log(`${run.gifts} gifts, $${run.dollars.toLocaleString("en-US")}, ${run.lines} lines, ${ms} ms`);
const broken = run.results.filter((r) => r.broken);
for (const b of broken) console.log(b.id, JSON.stringify(b.firstBroken));
if (broken.length) process.exitCode = 1;
if (!process.argv.includes("--dry")) {
  const results = run.results.map((r) => ({ id: r.id, promise: r.promise, kept: r.kept, broken: r.broken }));
  writeFileSync("content/eval/invariants-results.json", JSON.stringify({ ran_at: new Date().toISOString(), ms, ...run, results }, null, 2) + "\n");
}
