import { ok } from "@/lib/api/envelope";
import { api } from "@/lib/api/handler";
import { guard } from "@/lib/api/keys";
import { sampleBillRead } from "@/lib/ai/sample-bill";

/**
 * POST /api/live/sample-bill: Claude reads the sample electric bill now and the rules engine prices it, while the day's
 * AI spend is under the site's daily budget; otherwise the recorded reading, with `mode: "recorded"` and the reason.
 */
async function handle() {
  const started = Date.now();
  return ok(await sampleBillRead(), started);
}

export const POST = api("/api/live/sample-bill", (req: Request) => guard(req, "live-sample-bill", () => handle()));
