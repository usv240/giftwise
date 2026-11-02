import { eq } from "drizzle-orm";
import { audit } from "@/lib/audit";
import { db, dbConfigured, schema } from "@/lib/db";
import { captureAndRecord, syncFromPayPal } from "@/lib/paypal/capture";
import { paypalConfigured, paypalRest } from "@/lib/paypal/client";
import { syncBatch } from "@/lib/paypal/payouts";

/**
 * POST /api/paypal/webhook: PayPal tells Giftwise when a checkout is approved, a payment completes, or one is
 * declined or refunded. Every event is verified with PayPal's verify-webhook-signature API before it is used.
 * Webhooks are the safety net: if a giver approves and closes the window before returning, the approval event
 * completes the capture; if a capture response was lost, the completion event records it from PayPal's copy.
 */
type Event = {
  id?: string;
  event_type?: string;
  resource?: { id?: string; status?: string; supplementary_data?: { related_ids?: { order_id?: string } } };
};

const HEADERS = ["paypal-auth-algo", "paypal-cert-url", "paypal-transmission-id", "paypal-transmission-sig", "paypal-transmission-time"] as const;

async function verified(req: Request, event: unknown) {
  const h = Object.fromEntries(HEADERS.map((k) => [k, req.headers.get(k)]));
  if (HEADERS.some((k) => !h[k])) return false;
  const r = await paypalRest<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: h["paypal-auth-algo"],
      cert_url: h["paypal-cert-url"],
      transmission_id: h["paypal-transmission-id"],
      transmission_sig: h["paypal-transmission-sig"],
      transmission_time: h["paypal-transmission-time"],
      webhook_id: process.env.PAYPAL_WEBHOOK_ID!.trim(),
      webhook_event: event,
    }),
  });
  return r.status === 200 && r.body.verification_status === "SUCCESS";
}

export async function POST(req: Request) {
  if (!process.env.PAYPAL_WEBHOOK_ID?.trim() || !paypalConfigured() || !dbConfigured()) {
    return Response.json({ received: false, reason: "Webhooks are not configured on this server." }, { status: 503 });
  }
  const event = (await req.json().catch(() => null)) as Event | null;
  if (!event?.id || !event.event_type) return Response.json({ received: false, reason: "Not a PayPal event." }, { status: 400 });
  if (!(await verified(req, event))) return Response.json({ received: false, reason: "Signature not verified." }, { status: 400 });

  const type = event.event_type;
  const r = event.resource ?? {};
  const orderId = type.startsWith("CHECKOUT.ORDER.") ? (r.id ?? null) : (r.supplementary_data?.related_ids?.order_id ?? null);
  const captureId = type.startsWith("PAYMENT.CAPTURE.") ? (r.id ?? null) : null;
  let result = "noted";

  if (type === "CHECKOUT.ORDER.APPROVED" && orderId) {
    // The giver approved; capture now in case they never come back to Giftwise. Idempotent with the return route.
    result = (await captureAndRecord(orderId, { actor: "webhook" })).kind;
  } else if (type === "PAYMENT.CAPTURE.COMPLETED" && orderId) {
    result = (await syncFromPayPal(orderId, "webhook")).kind;
  } else if (type.startsWith("PAYMENT.PAYOUTS-ITEM.") || type.startsWith("PAYMENT.PAYOUTSBATCH.")) {
    // A payout item succeeded, failed, was unclaimed or returned: refresh the whole batch from PayPal.
    const batchId = (r as { payout_batch_id?: string; batch_header?: { payout_batch_id?: string } }).payout_batch_id ?? (r as { batch_header?: { payout_batch_id?: string } }).batch_header?.payout_batch_id;
    if (batchId) result = (await syncBatch(batchId, "webhook")).ok ? "synced" : "sync_failed";
  } else if (captureId && (type === "PAYMENT.CAPTURE.REFUNDED" || type === "PAYMENT.CAPTURE.REVERSED" || type === "PAYMENT.CAPTURE.DENIED")) {
    const status = type === "PAYMENT.CAPTURE.DENIED" ? "declined" : "refunded";
    const updated = await db().update(schema.payments).set({ status }).where(eq(schema.payments.captureId, captureId)).returning({ id: schema.payments.id });
    result = `${status}:${updated.length}`;
  }

  await audit("webhook", `paypal.webhook.${type.toLowerCase()}`, orderId ? `order:${orderId}` : `capture:${captureId ?? event.id}`, { eventId: event.id, captureId, orderId, status: r.status ?? null, result });
  return Response.json({ received: true });
}
