import { runAgentDemo } from "@/lib/agent/demo";
import { AiUnavailableError, aiAvailable } from "@/lib/ai/claude";
import { fail, ok } from "@/lib/api/envelope";
import { guard } from "@/lib/api/keys";
import { audit } from "@/lib/audit";

let lastRun = 0;

/** POST /api/agent-demo: run the outside assistant live against this server's MCP endpoint. One run a minute. */
async function handle(req: Request) {
  const started = Date.now();
  if (!aiAvailable()) return fail("upstream_unavailable", "The assistant needs the AI service, which is not connected on this server. The recorded run shows the full result.", 503);
  if (started - lastRun < 60_000) return fail("rate_limited", "The assistant ran a moment ago. Please wait a minute and run it again, or read the recorded run.", 429);
  lastRun = started;
  try {
    const origin = (process.env.RENDER_EXTERNAL_URL || new URL(req.url).origin).replace(/\/$/, "");
    const run = await runAgentDemo(origin);
    await audit("agent", "agent_demo.run", "household:maya", { tools: run.steps.filter((s) => s.kind === "call").map((s) => (s.kind === "call" ? s.tool : "")), ms: run.ms });
    return ok(run, started);
  } catch (e) {
    if (e instanceof AiUnavailableError) return fail("upstream_unavailable", e.message, 503);
    console.error("agent demo failed", e);
    return fail("internal", "The assistant could not finish this time. The recorded run shows the full result.", 500);
  }
}

export const POST = (req: Request) => guard(req, "agent-demo", () => handle(req));
