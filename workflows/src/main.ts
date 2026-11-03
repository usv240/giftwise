import { task, type TaskContext } from "@renderinc/sdk/workflows";
import { checkApi, checkPage, env, fileRun, runAll, runCase, type CheckResult } from "./checks";

/**
 * giftwise-checks: a Render Workflow that checks the hosted Giftwise from outside, the way a judge would.
 *
 * nightlyCheck fans out one task per check (each failure case against the PayPal sandbox, each page on the judges'
 * path, each public API promise), so every check runs on its own instance with its own retries. When they finish it
 * files the results with the app, which shows them on /judges. A Render cron job starts it every night; the
 * "Run the checks now" button on /judges starts it on demand.
 */

// PayPal's sandbox and a cold start can each fail once for reasons that are not ours: try twice more, 5 s then 10 s.
const retry = { maxRetries: 2, waitDurationMs: 5000, backoffScaling: 2 };

const caseTask = task({ name: "runCase", retry, timeoutSeconds: 300 }, async function runCaseTask(_ctx: TaskContext, id: string, title: string): Promise<CheckResult> {
  return { ...(await runCase(env(), id, title)), attempts: 1 };
});

const pageTask = task({ name: "checkPage", retry, timeoutSeconds: 120 }, async function checkPageTask(_ctx: TaskContext, id: string): Promise<CheckResult> {
  return { ...(await checkPage(env(), id)), attempts: 1 };
});

const apiTask = task({ name: "checkApi", retry, timeoutSeconds: 120 }, async function checkApiTask(_ctx: TaskContext, id: string): Promise<CheckResult> {
  return { ...(await checkApi(env(), id)), attempts: 1 };
});

task({ name: "nightlyCheck", timeoutSeconds: 1800 }, async function nightlyCheck(ctx: TaskContext, input?: { trigger?: string }) {
  const e = env();
  const startedAt = new Date().toISOString();
  const results = await runAll(e, {
    runCase: (id, title) => ctx.run(caseTask, id, title),
    checkPage: (id) => ctx.run(pageTask, id),
    checkApi: (id) => ctx.run(apiTask, id),
  });
  const filed = await fileRun(e, { source: "render-workflow", runId: ctx.metadata.taskRunId ?? "", startedAt, results });
  return { ...filed, trigger: input?.trigger ?? "dashboard" };
});
