import { fail, ok } from "@/lib/api/envelope";
import { ManageWebhookRequest } from "@/lib/api/schemas";
import { dbConfigured } from "@/lib/db";
import { sendTest, setWebhook } from "@/lib/manage";
import { publicOrigin } from "@/lib/origin";
import { api } from "@/lib/api/handler";

type Ctx = { params: Promise<{ token: string }> };
const noDb = () => fail("upstream_unavailable", "Managing a page needs the database, which is not connected on this server.", 503);
const notFound = () => fail("not_found", "That manage link does not match any page.", 404);

/** PUT /api/manage/{token}/webhook: set (or with null, remove) where gift events are sent. Returns the signing secret. */
async function putRoute(req: Request, { params }: Ctx) {
  const started = Date.now();
  if (!dbConfigured()) return noDb();
  const parsed = ManageWebhookRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid_request", "Send the webhook address as url, or null to remove it.", 400, parsed.error.issues);
  const r = await setWebhook((await params).token, parsed.data.url);
  if (!r) return notFound();
  if (!r.ok) return fail("invalid_request", r.reason, 400);
  return ok({ url: r.url, secret: r.secret }, started);
}

/** POST /api/manage/{token}/webhook: send a test event to the webhook. */
async function postRoute(req: Request, { params }: Ctx) {
  const started = Date.now();
  if (!dbConfigured()) return noDb();
  const r = await sendTest((await params).token, publicOrigin(req));
  if (!r) return notFound();
  if (r.sent) return ok({ sent: true, status: "status" in r ? r.status : 200 }, started);
  const why = "reason" in r && typeof r.reason === "string" ? r.reason : `The webhook answered ${"status" in r && r.status ? r.status : "nothing"}.`;
  return fail("upstream_unavailable", why, 502);
}

export const POST = api("/api/manage/[token]/webhook", postRoute);
export const PUT = api("/api/manage/[token]/webhook", putRoute);
