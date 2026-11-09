// Run test suites and write each one's count to content/test-results.json: the one file the README, TESTING.md and
// /evidence take their test numbers from. After recording, the count in each suite's row of docs/tests.md and TESTING.md
// tables is rewritten from the file, and tests/docs-numbers.test.ts fails whenever a document states another number.
//
//   node scripts/test-results.mjs unit smoke a11y api      run these suites, record them, update the two tables
//   node scripts/test-results.mjs --list                   show every suite id and its command
//
// Start the production server on port 3100 first for the end-to-end suites (BASE_URL to point elsewhere). A suite
// that does not pass in full is still recorded as it ran, and the script exits non-zero.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const FILE = "content/test-results.json";
const doc = JSON.parse(readFileSync(FILE, "utf8"));

/** How each suite is run here and how its count is read. Every e2e suite ends with "N passed, M failed". */
const RUN = {
  unit: { cmd: "npx", args: ["vitest", "run", "--reporter=json"], json: true },
  smoke: { cmd: "npm", args: ["run", "e2e:smoke"] },
  a11y: { cmd: "npm", args: ["run", "e2e:a11y"] },
  api: { cmd: "npm", args: ["run", "e2e:api"] },
  ui: { cmd: "npm", args: ["run", "e2e:ui"] },
  paypal: { cmd: "npm", args: ["run", "e2e:paypal"] },
  agent: { cmd: "npm", args: ["run", "e2e:agent"] },
  monthly: { cmd: "npm", args: ["run", "e2e:monthly"] },
  manage: { cmd: "npm", args: ["run", "e2e:manage"] },
  outside: { cmd: "npm", args: ["run", "checks:local"], pattern: /(\d+) of (\d+) passed/ },
  // Newman's summary table: requests and assertions executed, then failed. The request count is recorded too, so every
  // document states one number for it.
  postman: { cmd: "npm", args: ["run", "test:postman"], parse: (out) => {
    const m = /assertions\s*│\s*(\d+)\s*│\s*(\d+)/.exec(out);
    const r = /requests\s*│\s*(\d+)\s*│\s*(\d+)/.exec(out);
    return m && { passed: Number(m[1]) - Number(m[2]), total: Number(m[1]), ...(r ? { requests: Number(r[1]) } : {}) };
  } },
  // Each promise's kept and broken counts, then the number of gifts: a gift passes when it breaks no promise.
  invariants: { cmd: "npx", args: ["tsx", "scripts/run-invariants.ts"], parse: (out) => {
    const gifts = /(\d+) gifts, \$/.exec(out);
    const broken = [...out.matchAll(/broken (\d+)/g)].map((m) => Number(m[1]));
    return gifts && { passed: Number(gifts[1]) - Math.max(0, ...broken), total: Number(gifts[1]) };
  } },
};

const ids = process.argv.slice(2);
if (!ids.length || ids.includes("--list")) {
  for (const s of doc.suites) console.log(`${s.id.padEnd(10)} ${RUN[s.id] ? `${RUN[s.id].cmd} ${RUN[s.id].args.join(" ")}` : `${s.command} (recorded by hand)`}`);
  process.exit(0);
}

const n = (x) => x.toLocaleString("en-US");
/** A day in Pacific time, YYYY-MM-DD: the one calendar the site keeps (src/lib/time.ts). */
const pacificDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d);

/**
 * Rewrite the counts in every table row that names this suite's command: "N of M" in docs/tests.md, the first count in
 * TESTING.md, then "N requests" and the bare-run counts where the row states them.
 */
function writeDocs(suite) {
  for (const [file, re, to] of [
    ["docs/tests.md", /\d[\d,]* of \d[\d,]*/, `${n(suite.passed)} of ${n(suite.total)}`],
    ["TESTING.md", /\d[\d,]*/, n(suite.passed)],
  ]) {
    const text = readFileSync(file, "utf8");
    const out = text
      .split("\n")
      .map((l) => {
        const cells = l.split("|");
        const last = cells.length - 2; // the result is the last cell, the command the one before it
        if (!l.startsWith("|") || cells.length < 4 || cells[last - 1].trim() !== `\`${suite.command}\``) return l;
        cells[last] = cells[last].replace(re, to);
        if (suite.requests) cells[last] = cells[last].replace(/\d+ requests/, `${suite.requests} requests`);
        if (suite.bare) cells[last] = cells[last].replace(/\d+ pass and \d+ skip/, `${suite.bare.passed} pass and ${suite.bare.skipped} skip`);
        return cells.join("|");
      })
      .join("\n");
    if (out !== text) writeFileSync(file, out);
  }
  // The README's "Where to look" table names suites as "`command`, N of M"; each is rewritten from the record.
  {
    const text = readFileSync("README.md", "utf8");
    const esc = suite.command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const out = text.replace(new RegExp(`(\`${esc}\`, )\\d[\\d,]* of \\d[\\d,]*`, "g"), `$1${n(suite.passed)} of ${n(suite.total)}`);
    if (out !== text) writeFileSync("README.md", out);
  }
  // The README's "Run it yourself" line states both unit counts, each from its own recorded run.
  if (suite.bare && suite.with_database) {
    const text = readFileSync("README.md", "utf8");
    const out = text.replace(/a fresh clone with no \.env\.local: .*$/m, `a fresh clone with no .env.local: ${suite.bare.passed} pass and ${suite.bare.skipped} skip (${suite.bare.needs.database} need a database); ${withDatabaseLine(suite)}`);
    if (out !== text) writeFileSync("README.md", out);
  }
}

/**
 * The second half of the README's unit line, from the run with .env.local: every test when the database answered, and
 * otherwise what skipped and why, so the line never claims a database run that did not happen.
 */
export function withDatabaseLine(suite) {
  const w = suite.with_database;
  if (w.skipped === 0) return `when .env.local names a reachable database: ${n(w.passed)} of ${n(suite.total)}, no keys needed`;
  return `with .env.local: ${n(w.passed)} of ${n(suite.total)}, ${w.skipped} skipped because the database did not answer`;
}

/**
 * One unit run, with its counts: passed, failed, skipped, and how many skipped tests need each thing. `bare` runs it as
 * a fresh checkout does: GIFTWISE_TEST_BARE=1 makes tests/helpers/needs.ts ignore .env.local and every key, so every test
 * that needs a database or a key skips with its need in its name. Without it, the run reads .env.local as a developer's
 * does (only DATABASE_URL is used; no test calls Claude or PayPal), and the AI key is left blank either way.
 */
function runVitest(bare) {
  const dir = mkdtempSync(path.join(tmpdir(), bare ? "giftwise-bare-" : "giftwise-unit-"));
  const out = path.join(dir, "vitest.json");
  const env = { ...process.env, ANTHROPIC_API_KEY: "" };
  if (bare) env.GIFTWISE_TEST_BARE = "1";
  else delete env.GIFTWISE_TEST_BARE;
  spawnSync(["npx", "vitest", "run", "--reporter=json", `--outputFile="${out}"`].join(" "), { stdio: "inherit", shell: true, env });
  const r = JSON.parse(readFileSync(out, "utf8"));
  rmSync(dir, { recursive: true, force: true });
  const needs = { database: 0, claude: 0, paypal: 0 };
  const TAG = { database: "[needs a database]", claude: "[needs an Anthropic key]", paypal: "[needs PayPal sandbox keys]" };
  let skipped = 0;
  for (const f of r.testResults) {
    for (const t of f.assertionResults) {
      if (t.status !== "skipped" && t.status !== "pending") continue;
      skipped++;
      for (const k of Object.keys(TAG)) if (t.fullName.includes(TAG[k])) needs[k]++;
    }
  }
  return { passed: r.numPassedTests, failed: r.numFailedTests, skipped, total: r.numTotalTests, needs };
}
const runBare = () => runVitest(true);

/** One run of a suite: its passed and total counts. */
function runOnce(id) {
  const how = RUN[id];
  // One command line for the shell (npm and npx are .cmd files on Windows); the arguments here hold no user input.
  const line = (args) => [how.cmd, ...args].join(" ");
  if (how.json) {
    const dir = mkdtempSync(path.join(tmpdir(), "giftwise-unit-"));
    const out = path.join(dir, "vitest.json");
    spawnSync(line([...how.args, `--outputFile="${out}"`]), { stdio: "inherit", shell: true });
    const r = JSON.parse(readFileSync(out, "utf8"));
    rmSync(dir, { recursive: true, force: true });
    return { passed: r.numPassedTests, total: r.numTotalTests };
  }
  const r = spawnSync(line(how.args), { encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  process.stdout.write(out.split("\n").slice(-6).join("\n"));
  if (how.parse) {
    const p = how.parse(out);
    if (!p) throw new Error(`Could not read a count from ${id}; is the server running?`);
    return p;
  }
  const m = (how.pattern ?? /(\d+) passed, (\d+) failed/).exec(out.slice(-4000));
  if (!m) throw new Error(`Could not read a count from ${id}; is the server running?`);
  return { passed: Number(m[1]), total: how.pattern ? Number(m[2]) : Number(m[1]) + Number(m[2]) };
}

let short = false;
for (const id of ids) {
  const suite = doc.suites.find((s) => s.id === id);
  if (!suite || !RUN[id]) throw new Error(`No runnable suite "${id}". Try --list.`);
  const record = ({ passed, total, requests, bare, with_database, ranAt }) => {
    Object.assign(suite, { passed, total, ...(requests ? { requests } : {}), ...(bare ? { bare } : {}), ...(with_database ? { with_database } : {}), ranAt: ranAt ?? pacificDay() });
    writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n");
    writeDocs(suite);
  };
  let r;
  if (id === "unit") {
    // The unit suite includes the test that holds the README and the tables to this file, so a changed count first shows
    // up as that test failing. Run it as a fresh clone does (bare), then with .env.local, recording each as it ran and
    // rewriting the documents after each; repeat, at most three times, until neither run fails on stale numbers.
    let bare;
    for (let i = 0; i < 3; i++) {
      bare = runBare();
      record({ passed: suite.passed, total: suite.total, bare });
      const w = runVitest(false);
      r = { passed: w.passed, total: w.total, bare, with_database: { passed: w.passed, failed: w.failed, skipped: w.skipped, needs: w.needs } };
      record(r);
      if (!bare.failed && !w.failed) break;
    }
  } else {
    r = runOnce(id);
  }
  // The invariant run writes its own results file; its counts and day are read from there, so this row and the pages
  // that read that file (src/lib/test-results.ts) always state the same run.
  if (id === "invariants") {
    const inv = JSON.parse(readFileSync("content/eval/invariants-results.json", "utf8"));
    r = { passed: inv.gifts - Math.max(0, ...inv.results.map((x) => x.broken)), total: inv.gifts, ranAt: pacificDay(new Date(inv.ran_at)) };
  }
  record(r);
  if (suite.passed !== suite.total) short = true;
  console.log(`\n${id}: ${suite.passed} of ${suite.total}`);
}
doc.ranAt = doc.suites.map((s) => s.ranAt ?? doc.ranAt).sort().at(-1);
writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n");
console.log(`\nWrote ${FILE}, and the counts in the docs/tests.md and TESTING.md tables.`);
process.exitCode = short ? 1 : 0;
