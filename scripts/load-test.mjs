// Load test of the free paths: 100 concurrent runs, each a gift check (POST /api/v1/check-gift) followed by the gift
// page (GET /g/maya), against BASE_URL. Reports p50, p95, p99 and the error rate for each path and writes
// content/public/load-test.json, which /evidence shows under "Under load".
//
//   BASE_URL=http://localhost:3100 node scripts/load-test.mjs [concurrency] [rounds]
//
// Against the deployed site, gently: a few visitors, stopping after the first round with an error, written to its own
// file so /evidence shows it beside the laptop run, labeled by where each ran:
//   BASE_URL=https://giftwise-405i.onrender.com LOAD_WHERE=hosted node scripts/load-test.mjs 10 3
//
// Each run sends its own x-forwarded-for (198.51.100.0/24, a documentation range), so the demo tier's 20-a-minute limit
// per visitor sees 100 visitors arriving at once, the way a shared link does, rather than one visitor making 100 calls.
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";

const B = process.env.BASE_URL ?? "http://localhost:3100";
const CONCURRENCY = Number(process.argv[2] ?? 100);
const ROUNDS = Number(process.argv[3] ?? 3);
/** laptop: the server runs on this machine. hosted: the deployed site, reached over the internet. */
const WHERE = process.env.LOAD_WHERE === "hosted" ? "hosted" : "laptop";
const OUT = WHERE === "hosted" ? "content/public/load-test-hosted.json" : "content/public/load-test.json";
const PATHS = [
  { id: "check-gift", label: "POST /api/v1/check-gift", method: "POST", path: "/api/v1/check-gift", body: { gift: { amount: 1000, delivery: "cash", date: "2026-04-10" } }, expect: (j) => j?.data?.check_after === 74 },
  { id: "gift-page", label: "GET /g/maya", method: "GET", path: "/g/maya", expect: (t) => typeof t === "string" && t.includes("Maya") },
];

const pct = (xs, p) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};

async function one(p, visitor) {
  const t = performance.now();
  try {
    const r = await fetch(B + p.path, {
      method: p.method,
      headers: { "x-forwarded-for": `198.51.100.${visitor % 256}`, ...(p.body ? { "content-type": "application/json" } : {}) },
      body: p.body ? JSON.stringify(p.body) : undefined,
    });
    const payload = p.body ? await r.json().catch(() => null) : await r.text();
    const ms = performance.now() - t;
    return { ms, ok: r.status === 200 && p.expect(payload), status: r.status };
  } catch (e) {
    return { ms: performance.now() - t, ok: false, status: 0, error: String(e).slice(0, 80) };
  }
}

async function run(visitor) {
  const out = [];
  for (const p of PATHS) out.push({ id: p.id, ...(await one(p, visitor)) });
  return out;
}

// Warm the server's caches first so the numbers are the steady state, not the first compile.
for (const p of PATHS) await one(p, 0);

// One visitor at a time first, five requests per path: what a single request takes, before any queueing.
const sequential = {};
for (const p of PATHS) {
  const ms = [];
  for (let i = 0; i < 5; i++) ms.push((await one(p, 250)).ms);
  sequential[p.id] = Math.round(pct(ms, 50));
}

const samples = Object.fromEntries(PATHS.map((p) => [p.id, []]));
const started = performance.now();
for (let round = 0; round < ROUNDS; round++) {
  const t = performance.now();
  const results = await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => run(round * CONCURRENCY + i + 1)));
  for (const r of results.flat()) samples[r.id].push(r);
  console.log(`round ${round + 1}: ${CONCURRENCY} runs in ${Math.round(performance.now() - t)} ms`);
  // Stop at the first error: a load test never keeps pressing a service that has started to refuse.
  if (results.flat().some((r) => !r.ok)) {
    console.log(`stopping after round ${round + 1}: ${results.flat().filter((r) => !r.ok).length} requests did not pass`);
    break;
  }
}
const totalMs = Math.round(performance.now() - started);

const paths = PATHS.map((p) => {
  const xs = samples[p.id];
  const ms = xs.map((x) => x.ms);
  const errors = xs.filter((x) => !x.ok);
  const statuses = {};
  for (const x of xs) statuses[x.status] = (statuses[x.status] ?? 0) + 1;
  return {
    id: p.id,
    label: p.label,
    requests: xs.length,
    errors: errors.length,
    error_rate: Number((errors.length / xs.length).toFixed(4)),
    one_at_a_time_p50_ms: sequential[p.id],
    p50_ms: Math.round(pct(ms, 50)),
    p95_ms: Math.round(pct(ms, 95)),
    p99_ms: Math.round(pct(ms, 99)),
    max_ms: Math.round(Math.max(...ms)),
    statuses,
  };
});

const cpu = os.cpus()[0]?.model?.replace(/\s+/g, " ").trim() ?? "unknown CPU";
const report = {
  ran_at: new Date().toISOString(),
  base_url: B,
  concurrency: CONCURRENCY,
  where: WHERE,
  rounds: samples[PATHS[0].id].length / CONCURRENCY,
  runs: samples[PATHS[0].id].length,
  total_requests: paths.reduce((n, p) => n + p.requests, 0),
  total_ms: totalMs,
  requests_per_second: Number((paths.reduce((n, p) => n + p.requests, 0) / (totalMs / 1000)).toFixed(1)),
  method: `${CONCURRENCY} concurrent runs, ${ROUNDS} rounds, each run a gift check (POST /api/v1/check-gift, $1,000 as cash) then the gift page (GET /g/maya), after one warm-up request per path. Each run arrives as its own visitor (its own x-forwarded-for in 198.51.100.0/24), so the per-visitor demo limit sees ${CONCURRENCY} visitors at once. Latency is measured by the client from request start to the full body, with node's fetch ${WHERE === "hosted" ? "on a laptop, over the internet" : "on the same machine as the server"}.`,
  machine:
    WHERE === "hosted"
      ? `The deployed site: one Render Starter web service (0.5 CPU, 512 MB) and its Render Postgres, in Render's Oregon region; the client is a laptop (${cpu}, Node ${process.version}) on a home internet connection, so each time includes the network`
      : `${cpu}, ${os.cpus().length} threads, ${Math.round(os.totalmem() / 1024 ** 3)} GB, ${os.platform()} ${os.release()}, Node ${process.version}; the server is the production build (next start) with Postgres 17 in Docker on the same machine`,
  paths,
};
mkdirSync("content/public", { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");
for (const p of paths) console.log(`${p.label}: ${p.requests} requests, p50 ${p.p50_ms} ms, p95 ${p.p95_ms} ms, p99 ${p.p99_ms} ms, errors ${p.errors} (${(p.error_rate * 100).toFixed(1)}%)`);
console.log(`${report.total_requests} requests in ${totalMs} ms, ${report.requests_per_second} a second; written to ${OUT}`);
process.exitCode = paths.some((p) => p.error_rate > 0.01) ? 1 : 0;
