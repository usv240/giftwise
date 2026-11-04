import { today } from "@/lib/api/envelope";
import { publicOrigin } from "@/lib/origin";
import { giftSubject } from "@/lib/report/data";
import { reminderIcs } from "@/lib/report/easy";
import { buildReport, currentReportMonth } from "@/lib/report/ssa";
import { monthOf } from "@/lib/rules";

/**
 * GET /g/{slug}/report/reminder?month=2026-10&lang=en|es
 * A calendar file for the person and whoever helps them: the month's report on its due date (with an alert three
 * days before) and a monthly look at the report on the 5th. Nothing about the person leaves the site but the link.
 */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const q = new URL(req.url).searchParams;
  const lang = q.get("lang") === "es" ? "es" : "en";
  const month = q.get("month");
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return new Response("Not found", { status: 404 });
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return new Response("month is a year and month, like 2026-10.", { status: 400 });
  const subject = await giftSubject(slug);
  if (!subject) return new Response("Not found", { status: 404 });
  const now = today();
  const months = [...new Set(subject.gifts.map((g) => monthOf(g.date)))];
  const r = buildReport({ name: subject.name, profile: subject.profile, gifts: subject.gifts, month: month ?? currentReportMonth(now, months), today: now });
  const url = `${publicOrigin(req)}/g/${slug}/report/easy?month=${r.month}${lang === "es" ? "&lang=es" : ""}`;
  return new Response(reminderIcs(r, lang, url), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="giftwise-report-reminder-${slug}-${r.month}.ics"` },
  });
}
