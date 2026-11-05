import { Render } from "@renderinc/sdk";

/** The nightly cron job: start giftwise-checks/nightlyCheck on Render Workflows and exit. The run files its own results. */
const slug = process.env.CHECKS_WORKFLOW_SLUG;
if (!slug || !process.env.RENDER_API_KEY) {
  console.error("Set CHECKS_WORKFLOW_SLUG and RENDER_API_KEY to start the checks.");
  process.exit(1);
}
const render = new Render();
const run = await render.workflows.startTask(`${slug}/nightlyCheck`, [{ trigger: "nightly" }]);
console.log(`Started ${slug}/nightlyCheck as ${run.taskRunId}`);

// On the 1st, plan every monthly gift's month; on Sundays, rebuild the rulebook index.
const now = new Date();
if (now.getUTCDate() === 1) {
  const m = await render.workflows.startTask(`${slug}/monthlyRun`, [{ month: now.toISOString().slice(0, 7) }]);
  console.log(`Started ${slug}/monthlyRun as ${m.taskRunId}`);
}
if (now.getUTCDay() === 0) {
  const r = await render.workflows.startTask(`${slug}/rulebookIndex`, []);
  console.log(`Started ${slug}/rulebookIndex as ${r.taskRunId}`);
}
