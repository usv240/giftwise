import { guard } from "@/lib/api/keys";
import { fail, ok, today } from "@/lib/api/envelope";
import { log } from "@/lib/log";
import { ReviewBillRequest } from "@/lib/api/schemas";
import { AiRefusedError, AiUnavailableError, aiAvailable, replayAvailable } from "@/lib/ai/claude";
import { reviewPayload, runReviewers } from "@/lib/ai/reviewers";
import { DEFAULT_PROFILE, type Profile } from "@/lib/rules";
import { api } from "@/lib/api/handler";

/** POST /api/v1/review-bill: two reviewers with different authorities, a quote-checking referee, then the rules engine. */
async function handle(req: Request) {
  const started = Date.now();
  const parsed = ReviewBillRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request", "Send JSON with description, amount and category.", 400, parsed.error.issues);
  // With no key, the sample bill's two reviews replay from their recorded answers (content/ai-replay); any other bill is unavailable.
  if (!aiAvailable() && !(await replayAvailable())) {
    return fail("upstream_unavailable", "The reviewers need the AI service, which is not connected on this server yet. Open the Electric bill example to see a recorded review.", 503);
  }
  const b = parsed.data;
  const profile = { ...DEFAULT_PROFILE, ...(b.profile ?? {}) } as Profile;
  try {
    const run = await runReviewers({ description: b.description, gift: { id: "review", date: b.date ?? today(), amount: b.amount, delivery: "vendor", category: b.category, recurring: b.recurring } }, profile);
    return ok(reviewPayload(run), started, { model: run.model, replayed: run.replayed, ...(run.recordedAt ? { recorded_at: run.recordedAt } : {}) });
  } catch (e) {
    if (e instanceof AiUnavailableError) return fail("upstream_unavailable", `${e.message} Open the Electric bill example to see a recorded review.`, 503);
    if (e instanceof AiRefusedError) return fail("upstream_unavailable", "The reviewers could not answer this one. Try describing the bill in other words.", 422);
    log.error("review-bill failed", { err: e });
    return fail("internal", "Something went wrong while the reviewers worked. Please try again.", 500);
  }
}

const postRoute = (req: Request) => guard(req, "review-bill", () => handle(req));

export const POST = api("/api/v1/review-bill", postRoute);
