import { fail, ok, today } from "@/lib/api/envelope";
import { guard } from "@/lib/api/keys";
import { giftSubject } from "@/lib/report/data";
import { buildReport, currentReportMonth, reportCsv, reportJson } from "@/lib/report/ssa";
import { monthOf } from "@/lib/rules";

/**
 * GET /api/v1/ssa-report?page=maya&month=2026-10&view=given|cash&format=csv
 * One month's report to Social Security for a gift page: what to tell SSA by the 10th, and the PayPal records that
 * show every other gift went straight to a shop or an ABLE account.
 */
async function handle(req: Request) {
  const started = Date.now();
  const q = new URL(req.url).searchParams;
  const page = (q.get("page") ?? "maya").trim().toLowerCase();
  const month = q.get("month");
  const view = q.get("view") ?? "given";
  if (!/^[a-z0-9-]{1,60}$/.test(page)) return fail("invalid_request", "page is the gift page id, the part after /g/ in its address.", 400);
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return fail("invalid_request", "month is a year and month, like 2026-10.", 400);
  if (view !== "given" && view !== "cash") return fail("invalid_request", 'view is "given" (as the gifts were made) or "cash" (as if every gift had been cash).', 400);

  const subject = await giftSubject(page);
  if (!subject) return fail("not_found", "There is no gift page with that id.", 404);
  const now = today();
  const months = [...new Set(subject.gifts.map((g) => monthOf(g.date)))];
  const report = buildReport({ name: subject.name, profile: subject.profile, gifts: subject.gifts, month: month ?? currentReportMonth(now, months), today: now, view });

  if (q.get("format") === "csv") {
    return new Response(reportCsv(report), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="giftwise-ssa-report-${subject.slug}-${report.month}.csv"` },
    });
  }
  return ok(reportJson(report), started);
}

export const GET = (req: Request) => guard(req, "ssa-report", () => handle(req));
