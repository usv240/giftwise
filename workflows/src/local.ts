import { checkApi, checkPage, env, fileRun, runAll, runCase, withRetry } from "./checks";

/**
 * The same run as Render Workflows' nightlyCheck, in one process, for development. From the repo root:
 *   npm run checks:local                    (checks http://localhost:3100)
 *   BASE_URL=https://... npm run checks:local
 * CHECKS_SECRET comes from .env.local and must match the server's.
 */
process.env.APP_URL = process.env.BASE_URL ?? "http://localhost:3100";
const e = env();
const startedAt = new Date().toISOString();
const results = await runAll(e, {
  runCase: (id, title) => withRetry(() => runCase(e, id, title)),
  checkPage: (id) => withRetry(() => checkPage(e, id)),
  checkApi: (id) => withRetry(() => checkApi(e, id)),
});
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  [${r.group}] ${r.title}  | ${r.detail.slice(0, 140)}`);
const filed = await fileRun(e, { source: "local", runId: "", startedAt, results });
console.log(`\n${filed.passed} of ${filed.total} passed; filed as run ${filed.id}`);
