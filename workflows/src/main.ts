import { task, type TaskContext } from "@renderinc/sdk/workflows";
import { checkApi, checkPage, env, fileRun, listMonthly, planMonthly, reindexRulebook, runAll, runCase, thisMonth, type CheckResult } from "./checks";

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

/**
 * monthlyRun: on the 1st, plan every active monthly gift's month ahead of time, one task per gift, so each giver's
 * page already shows the month's split and what changed when they open it. Each gift's plan runs the rules engine
 * on that household as it stands; a failure in one gift retries on its own and never holds up the others.
 */
const planTask = task({ name: "planMonthly", retry, timeoutSeconds: 120 }, async function planMonthlyTask(_ctx: TaskContext, id: number, month: string) {
  return planMonthly(env(), id, month);
});

task({ name: "monthlyRun", timeoutSeconds: 1800 }, async function monthlyRun(ctx: TaskContext, input?: { month?: string }) {
  const e = env();
  const month = input?.month ?? thisMonth();
  const ids = await listMonthly(e);
  const planned = await Promise.all(ids.map((id) => ctx.run(planTask, id, month).catch((err: Error) => ({ id, month, error: err.message }))));
  return { month, gifts: ids.length, planned: planned.filter((p) => !("error" in p)).length, failed: planned.filter((p) => "error" in p) };
});

/** rulebookIndex: rebuild the Elastic rulebook index from the rule files the engine and reviewers cite. */
task({ name: "rulebookIndex", retry, timeoutSeconds: 600 }, async function rulebookIndex() {
  return reindexRulebook(env());
});
