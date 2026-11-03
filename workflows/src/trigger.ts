import { Render } from "@renderinc/sdk";

/** The nightly cron job: start giftwise-checks/nightlyCheck on Render Workflows and exit. The run files its own results. */
const slug = process.env.CHECKS_WORKFLOW_SLUG;
if (!slug || !process.env.RENDER_API_KEY) {
  console.error("Set CHECKS_WORKFLOW_SLUG and RENDER_API_KEY to start the checks.");
  process.exit(1);
}
const run = await new Render().workflows.startTask(`${slug}/nightlyCheck`, [{ trigger: "nightly" }]);
console.log(`Started ${slug}/nightlyCheck as ${run.taskRunId}`);
