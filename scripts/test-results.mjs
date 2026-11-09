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
  // The README's "Run it yourself" line states both unit counts; it is rewritten from the same record.
  if (suite.bare) {
    const text = readFileSync("README.md", "utf8");
    const out = text.replace(
      /a fresh clone with no \.env\.local: \d+ pass and \d+ skip \(\d+ need a database\); when \.env\.local names a reachable database: \d[\d,]* of \d[\d,]*, no keys needed/,
      `a fresh clone with no .env.local: ${suite.bare.passed} pass and ${suite.bare.skipped} skip (${suite.bare.needs.database} need a database); when .env.local names a reachable database: ${n(suite.passed)} of ${n(suite.total)}, no keys needed`,
    );
    if (out !== text) writeFileSync("README.md", out);
  }
}

/**
 * The unit suite run as a fresh checkout runs it: GIFTWISE_TEST_BARE=1 makes tests/helpers/needs.ts ignore .env.local
 * and every key, so every test that needs a database or a key skips with its need in its name. Returns the passed and
 * skipped counts and how many skipped tests need each thing.
 */
function runBare() {
  const dir = mkdtempSync(path.join(tmpdir(), "giftwise-bare-"));
  const out = path.join(dir, "vitest.json");
  spawnSync(["npx", "vitest", "run", "--reporter=json", `--outputFile="${out}"`].join(" "), { stdio: "inherit", shell: true, env: { ...process.env, GIFTWISE_TEST_BARE: "1" } });
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
  return { passed: r.numPassedTests, failed: r.numFailedTests, skipped, needs };
}

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
  const record = ({ passed, total, requests, bare }) => {
    Object.assign(suite, { passed, total, ...(requests ? { requests } : {}), ...(bare ? { bare } : {}), ranAt: new Date().toISOString().slice(0, 10) });
    writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n");
    writeDocs(suite);
  };
  let r;
  if (id === "unit") {
    // The unit suite includes the test that holds the README and the tables to this file, so a changed count first
    // shows up as that test failing. The bare run goes first: record it, rewrite the documents, and run it again when
    // the stale numbers were the only failures; then the full run the same way.
    let bare = runBare();
    record({ passed: suite.passed, total: suite.total, bare });
    if (bare.failed) {
      bare = runBare();
      record({ passed: suite.passed, total: suite.total, bare });
    }
    r = runOnce(id);
    if (r.passed !== r.total) {
      record({ passed: r.total, total: r.total, bare });
      r = runOnce(id);
    }
    r = { ...r, bare };
  } else {
    r = runOnce(id);
  }
  record(r);
  if (suite.passed !== suite.total) short = true;
  console.log(`\n${id}: ${suite.passed} of ${suite.total}`);
}
doc.ranAt = doc.suites.map((s) => s.ranAt ?? doc.ranAt).sort().at(-1);
writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n");
console.log(`\nWrote ${FILE}, and the counts in the docs/tests.md and TESTING.md tables.`);
process.exitCode = short ? 1 : 0;
