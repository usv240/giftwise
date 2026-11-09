import { runAgentDemo } from "@/lib/agent/demo";
import { log } from "@/lib/log";
import { hit } from "@/lib/rate-limit";
import { AI_DAILY_CAP_USD, AiUnavailableError, aiAvailable } from "@/lib/ai/claude";
import { aiSpentToday } from "@/lib/ai/budget";
import { fail, ok } from "@/lib/api/envelope";
import { guard } from "@/lib/api/keys";
import { audit } from "@/lib/audit";
import { publicOrigin } from "@/lib/origin";
import { api } from "@/lib/api/handler";

/** POST /api/agent-demo: run the outside assistant live against this server's MCP endpoint. One run a minute, across every instance. */
async function handle(req: Request) {
  const started = Date.now();
  if (!aiAvailable()) return fail("upstream_unavailable", "The assistant needs the AI service, which is not connected on this server. The recorded run shows the full result.", 503);
  // The assistant is the site's largest AI step, so it runs only while the day's spend is under the budget /agents shows.
  if ((await aiSpentToday().catch(() => 0)) >= AI_DAILY_CAP_USD) return fail("upstream_unavailable", "Today's AI budget is spent, so the recorded run shows the full result. It resets at midnight Pacific time.", 503);
  if (!(await hit("agent-demo", 60, 1)).allowed) return fail("rate_limited", "The assistant ran a moment ago. Please wait a minute and run it again, or read the recorded run.", 429);
  try {
    const run = await runAgentDemo(publicOrigin(req));
    await audit("agent", "agent_demo.run", "household:maya", { tools: run.steps.filter((s) => s.kind === "call").map((s) => (s.kind === "call" ? s.tool : "")), ms: run.ms });
    return ok(run, started);
  } catch (e) {
    if (e instanceof AiUnavailableError) return fail("upstream_unavailable", e.message, 503);
    log.error("agent demo failed", { err: e });
    return fail("internal", "The assistant could not finish this time. The recorded run shows the full result.", 500);
  }
}

const postRoute = (req: Request) => guard(req, "agent-demo", () => handle(req));

export const POST = api("/api/agent-demo", postRoute);
