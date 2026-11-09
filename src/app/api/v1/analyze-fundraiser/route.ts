import { guard } from "@/lib/api/keys";
import { fail, ok, today } from "@/lib/api/envelope";
import { log } from "@/lib/log";
import { AnalyzeFundraiserRequest } from "@/lib/api/schemas";
import { AiRefusedError, AiUnavailableError, aiAvailable, replayAvailable } from "@/lib/ai/claude";
import { readFundraiser } from "@/lib/ai/tasks";
import { DEFAULT_PROFILE, evaluateGift, usd, type Category } from "@/lib/rules";
import { readBundledSample, readPage, safePublicUrl } from "@/lib/sponsors/kernel";
import { publicOrigin } from "@/lib/origin";
import { api } from "@/lib/api/handler";

const SHELTER: Category[] = ["rent", "mortgage", "property_tax", "utility"];

/** POST /api/v1/analyze-fundraiser: read a public fundraiser page and plan benefit-safe delivery. */
async function handle(req: Request) {
  const started = Date.now();
  const parsed = AnalyzeFundraiserRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request", "Send JSON with a url field.", 400);
  // The sample this site ships, whether it arrives as "/samples/x.html" or as this site's full address for it.
  const own = (() => {
    try {
      const u = new URL(parsed.data.url, publicOrigin(req));
      const origins = [publicOrigin(req), new URL(req.url).origin];
      return origins.includes(u.origin) ? u.pathname : null;
    } catch {
      return null;
    }
  })();
  const bundled = own?.startsWith("/samples/") ? await readBundledSample(own) : null;
  const url = bundled ? new URL(parsed.data.url, publicOrigin(req)) : safePublicUrl(parsed.data.url.startsWith("/") ? new URL(parsed.data.url, publicOrigin(req)).toString() : parsed.data.url);
  if (!url) return fail("invalid_request", "Use a public web address that starts with http or https.", 400);
  // With no key, the sample this site ships is still read, from Claude's recorded answer to it (content/ai-replay).
  if (!aiAvailable() && !(bundled && (await replayAvailable()))) {
    return fail("upstream_unavailable", "Reading fundraiser pages needs the AI service, which is not connected on this server yet. Open the Accessible van fundraiser example to see the full result.", 503);
  }
  try {
    const page = bundled ?? (await readPage(url));
    if (page.text.length < 40) return fail("invalid_request", "That page did not have readable text. Check the link and try again.", 422);
    // The shipped sample's recorded answer is found by its path (keyUrl), the same on every host.
    const { data, model, replayed, recordedAt } = await readFundraiser(page.text, url.toString(), { keyUrl: bundled && own ? own : undefined });
    const total = data.raised_amount ?? data.goal_amount ?? data.uses.reduce((s, u) => s + (u.amount ?? 0), 0);
    const plan = data.uses.map((u) => {
      const amount = u.amount ?? 0;
      const shelter = SHELTER.includes(u.category);
      const route = shelter ? "able" : u.category === "other" ? "item" : "vendor";
      const asCash = evaluateGift({ id: "cash", date: today(), amount, delivery: "cash", category: u.category }, DEFAULT_PROFILE);
      const safe = evaluateGift({ id: "safe", date: today(), amount, delivery: route, category: u.category }, DEFAULT_PROFILE);
      return { use: u.description, amount, category: u.category, route, likely_vendor: u.likely_vendor, check_if_cash: asCash.checkAfter, check_with_route: safe.checkAfter };
    });
    const routed = plan.reduce((s, p) => s + p.amount, 0);
    return ok(
      {
        page: { title: page.title || data.title, read_via: page.via, live_view_url: page.liveViewUrl ?? null },
        fundraiser: data,
        plan,
        summary: `Here is how ${usd(routed || total)} can reach her and keep her full benefits.`,
      },
      started,
      { model, replayed, ...(recordedAt ? { recorded_at: recordedAt } : {}) },
    );
  } catch (e) {
    if (e instanceof AiUnavailableError) return fail("upstream_unavailable", `${e.message} Open the Accessible van fundraiser example to see the full result.`, 503);
    if (e instanceof AiRefusedError) return fail("upstream_unavailable", "The AI could not read this page.", 422);
    log.error("analyze-fundraiser failed", { err: e });
    return fail("internal", "Something went wrong while reading the page. Please try again.", 500);
  }
}

const postRoute = (req: Request) => guard(req, "analyze-fundraiser", () => handle(req));

export const POST = api("/api/v1/analyze-fundraiser", postRoute);
