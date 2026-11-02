import { fail } from "@/lib/api/envelope";
import { getPreset, presetCsv, runPreset } from "@/lib/presets";

/** GET /api/presets/:id downloads a preset's input and the engine's current answer. ?format=csv for gift lists. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = getPreset(id);
  if (!p) return fail("not_found", "No preset with that id. See /developers/docs for the list.", 404);
  const format = new URL(req.url).searchParams.get("format");
  if (format === "csv") {
    return new Response(presetCsv(p), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="giftwise-${id}.csv"` },
    });
  }
  const run = runPreset(p);
  const body = {
    preset: p,
    result: run.kind === "gift" ? { check_after: run.result.checkAfter, best_route: run.result.bestRoute, check_with_best_route: run.result.checkWithBestRoute, rule_ids: run.result.ruleIds, explanation: run.result.explanation } : { months: run.plan.months },
    how_to_try: "POST the preset.gift (or each item of preset.gifts) to /api/v1/check-gift, or the gifts array to /api/v1/plan-month.",
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="giftwise-${id}.json"` },
  });
}
