import { eq, sql } from "drizzle-orm";
import { audit } from "../audit";
import { db, schema } from "../db";
import { paypalRest } from "./client";

export type CaptureLine = { reference_id: string; capture_id: string | null; amount: string | null; payee: string };
export type CaptureOutcome =
  | { kind: "not_found" }
  | { kind: "already"; captures: CaptureLine[] }
  | { kind: "captured"; captures: CaptureLine[]; payerFirstName: string | null; status: string }
  | { kind: "declined"; plain: string; issue: string; debugId: string | null; status: number }
  | { kind: "failed"; plain: string; issue: string; debugId: string | null; status: number };

type PayPalOrder = {
  status?: string;
  name?: string;
  details?: { issue?: string }[];
  debug_id?: string;
  payer?: { name?: { given_name?: string; surname?: string } };
  purchase_units?: { reference_id?: string; payments?: { captures?: { id?: string; amount?: { value?: string } }[] } }[];
};
type PaymentRow = typeof schema.payments.$inferSelect;
type Actor = "person" | "webhook";

/**
 * Capture an approved order and record it. An order can pay several recipients (one purchase unit each);
 * every unit's capture is matched back to its payment row and its need.
 * `mock` sends PayPal's sandbox negative-testing header, used only by the judges' failure-case runner.
 */
export async function captureAndRecord(orderId: string, opts: { mock?: "INSTRUMENT_DECLINED"; actor?: Actor } = {}): Promise<CaptureOutcome> {
  const d = db();
  const actor = opts.actor ?? "person";
  const rows = await d.select().from(schema.payments).where(eq(schema.payments.orderId, orderId));
  if (rows.length === 0) return { kind: "not_found" };
  if (rows.every((r) => r.status === "captured")) return { kind: "already", captures: lines(rows) };

  // Same request id on retries: a double click or a network retry can never capture twice.
  const res = await paypalRest<PayPalOrder>(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    requestId: `capture-${orderId}`,
    headers: { Prefer: "return=representation", ...(opts.mock ? { "PayPal-Mock-Response": JSON.stringify({ mock_application_codes: opts.mock }) } : {}) },
  });
  const body = res.body;
  if (res.status >= 400 || body.status !== "COMPLETED") {
    const issue = body.details?.[0]?.issue ?? body.name ?? body.status ?? "PAYPAL_ERROR";
    // Captured elsewhere already (for example by a webhook a moment earlier): record from PayPal's copy instead.
    if (issue === "ORDER_ALREADY_CAPTURED") return syncFromPayPal(orderId, actor);
    const info = { issue, debugId: res.debugId ?? body.debug_id ?? null, status: res.status >= 400 ? res.status : 502 };
    const declined = issue === "INSTRUMENT_DECLINED";
    await d
      .update(schema.payments)
      .set({ status: declined ? "declined" : "failed", debugId: info.debugId })
      .where(eq(schema.payments.orderId, orderId));
    await audit(actor, declined ? "paypal.payment.declined" : "paypal.capture.failed", `order:${orderId}`, { issue });
    return { kind: declined ? "declined" : "failed", plain: PLAIN[issue] ?? "PayPal could not complete this step. Please try again.", ...info };
  }
  return record(orderId, rows, body, actor);
}

/**
 * Record captures from PayPal's own copy of the order, without capturing again. Used when PayPal reports a payment
 * Giftwise has not recorded yet, for example when the connection dropped during capture.
 */
export async function syncFromPayPal(orderId: string, actor: Actor = "webhook"): Promise<CaptureOutcome> {
  const rows = await db().select().from(schema.payments).where(eq(schema.payments.orderId, orderId));
  if (rows.length === 0) return { kind: "not_found" };
  if (rows.every((r) => r.status === "captured")) return { kind: "already", captures: lines(rows) };
  const res = await paypalRest<PayPalOrder>(`/v2/checkout/orders/${orderId}`, { method: "GET" });
  if (res.status >= 400 || res.body.status !== "COMPLETED") {
    return { kind: "failed", plain: "PayPal has not completed this payment yet.", issue: res.body.status ?? res.body.name ?? "NOT_COMPLETED", debugId: res.debugId, status: res.status >= 400 ? res.status : 409 };
  }
  return record(orderId, rows, res.body, actor);
}

async function record(orderId: string, rows: PaymentRow[], body: PayPalOrder, actor: Actor): Promise<CaptureOutcome> {
  const d = db();
  const g = body.payer?.name;
  const payer = g ? [g.given_name, g.surname].filter(Boolean).join(" ") : null;
  const now = new Date();
  const captures: CaptureLine[] = [];
  for (const pu of body.purchase_units ?? []) {
    const row = rows.find((r) => r.referenceId === pu.reference_id) ?? (rows.length === 1 ? rows[0] : undefined);
    const cap = pu.payments?.captures?.[0];
    if (!row || !cap || row.status === "captured") continue;
    await d.update(schema.payments).set({ status: "captured", captureId: cap.id ?? null, payerName: payer, capturedAt: now }).where(eq(schema.payments.id, row.id));
    if (row.needId) {
      await d
        .update(schema.needs)
        .set({
          funded: sql`${schema.needs.funded} + ${row.amount}`,
          status: sql`case when ${schema.needs.funded} + ${row.amount} >= ${schema.needs.amount} then 'paid' else 'partial' end`,
        })
        .where(eq(schema.needs.id, row.needId));
    }
    captures.push({ reference_id: row.referenceId, capture_id: cap.id ?? null, amount: cap.amount?.value ?? null, payee: row.payeeName });
  }
  await audit(actor, "paypal.order.captured", `order:${orderId}`, { captures: captures.map((c) => ({ ref: c.reference_id, capture: c.capture_id, amount: c.amount })) });
  return { kind: "captured", captures, payerFirstName: g?.given_name ?? null, status: body.status ?? "COMPLETED" };
}

const lines = (rows: PaymentRow[]): CaptureLine[] => rows.map((r) => ({ reference_id: r.referenceId, capture_id: r.captureId, amount: r.amount, payee: r.payeeName }));

const PLAIN: Record<string, string> = {
  INSTRUMENT_DECLINED: "That payment method was declined, so nothing was charged. Please choose another one in PayPal.",
  ORDER_NOT_APPROVED: "PayPal has not approved this payment yet, so nothing was charged.",
  ORDER_ALREADY_CAPTURED: "This payment is already complete.",
  PAYER_ACTION_REQUIRED: "PayPal needs one more step from the payer. Please try again.",
};
