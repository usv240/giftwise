import { captureAndRecord } from "@/lib/paypal/capture";
import { publicOrigin } from "@/lib/origin";

/**
 * GET /api/paypal/return?token=ORDER_ID: where PayPal sends a person after they approve a checkout opened from an
 * approval link (for example, one an AI agent prepared). Giftwise captures on the server, then shows the receipt.
 * Capturing is idempotent, so a reload or a second visit cannot charge twice.
 */
export async function GET(req: Request) {
  const origin = publicOrigin(req);
  const orderId = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[A-Z0-9]{10,24}$/.test(orderId)) return Response.redirect(`${origin}/`, 303);
  const r = await captureAndRecord(orderId);
  const to = new URL(`${origin}/r/${orderId}`);
  if (r.kind === "declined" || r.kind === "failed") to.searchParams.set("note", r.plain);
  return Response.redirect(to, 303);
}
