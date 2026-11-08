import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { audit } from "../audit";
import { db, schema } from "../db";
import { log } from "../log";
import { paypalRest } from "./client";
import { notifyGift } from "../manage";
import { publicOrigin } from "../origin";

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
type Actor = "person" | "webhook" | "system";

/**
 * Capture an approved order and record it. An order can pay several recipients (one purchase unit each);
 * every unit's capture is matched back to its payment row and its need.
 * `mock` sends PayPal's sandbox negative-testing header, used only by the Evidence page's failure-case runner.
 */
export async function captureAndRecord(orderId: string, opts: { mock?: "INSTRUMENT_DECLINED"; actor?: Actor } = {}): Promise<CaptureOutcome> {
  const d = db();
  const actor = opts.actor ?? "person";
  const rows = await d.select().from(schema.payments).where(eq(schema.payments.orderId, orderId));
  if (rows.length === 0) return { kind: "not_found" };
  if (rows.every((r) => r.status === "captured")) return { kind: "already", captures: lines(rows) };

  // Same request id on retries: a double click or a network retry can never capture twice. A second capture that
  // arrives while the first is still in flight gets a 500 from PayPal's sandbox; a 5xx is safe to retry with the same
  // PayPal-Request-Id, and the retry gets the first capture's answer.
  const capture = () =>
    paypalRest<PayPalOrder>(`/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      requestId: `capture-${orderId}`,
      headers: { Prefer: "return=representation", ...(opts.mock ? { "PayPal-Mock-Response": JSON.stringify({ mock_application_codes: opts.mock }) } : {}) },
    });
  let res = await capture();
  for (let attempt = 1; res.status >= 500 && attempt <= 3; attempt++) {
    await new Promise((r) => setTimeout(r, 700 * attempt));
    res = await capture();
  }
  const body = res.body;
  // Still a 5xx after the retries: the other click is usually finishing this very capture, so wait for its record.
  if (res.status >= 500) {
    const done = await waitForCaptured(orderId);
    if (done) return { kind: "captured", captures: lines(done), payerFirstName: done.find((r) => r.payerName)?.payerName?.split(" ")[0] ?? null, status: "COMPLETED" };
  }
  if (res.status >= 400 || body.status !== "COMPLETED") {
    const issue = body.details?.[0]?.issue ?? body.name ?? body.status ?? "PAYPAL_ERROR";
    // Captured elsewhere already (for example by a webhook a moment earlier): record from PayPal's copy instead.
    if (issue === "ORDER_ALREADY_CAPTURED") return syncFromPayPal(orderId, actor);
    const info = { issue, debugId: res.debugId ?? body.debug_id ?? null, status: res.status >= 400 ? res.status : 502 };
    const declined = issue === "INSTRUMENT_DECLINED";
    // A failed attempt never overwrites a capture another call already recorded.
    await d
      .update(schema.payments)
      .set({ status: declined ? "declined" : "failed", debugId: info.debugId })
      .where(and(eq(schema.payments.orderId, orderId), ne(schema.payments.status, "captured")));
    await audit(actor, declined ? "paypal.payment.declined" : "paypal.capture.failed", `order:${orderId}`, { issue });
    log.warn(declined ? "payment declined" : "capture failed", { orderId, issue, debugId: info.debugId, status: info.status, actor });
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

/**
 * Record each purchase unit's capture once. Two captures of one order can run at the same moment (a double click, or a
 * webhook and the return page); PayPal answers both, because they share a PayPal-Request-Id. Only the call that moves a
 * row from not captured to captured counts it toward the need, so the money is never counted twice, and both calls
 * return the captures as recorded. A repeated answer can leave out the captures, so then PayPal's own copy is read.
 *
 * Each row's flip and its need's total change together, in one transaction holding a share of the household row. A
 * reset of the sample page (resetSample in src/lib/households.ts) takes that row for itself, so the two never cross: a
 * payment the reset moved to an earlier round is still recorded as captured, and its receipt still opens, but it does
 * not count toward the reopened needs.
 */
async function record(orderId: string, rows: PaymentRow[], body: PayPalOrder, actor: Actor): Promise<CaptureOutcome> {
  const d = db();
  const g = body.payer?.name;
  const payer = g ? [g.given_name, g.surname].filter(Boolean).join(" ") : null;
  const now = new Date();
  const flippedHere: CaptureLine[] = [];
  const apply = async (order: PayPalOrder) => {
    for (const pu of order.purchase_units ?? []) {
      const row = rows.find((r) => r.referenceId === pu.reference_id) ?? (rows.length === 1 ? rows[0] : undefined);
      const cap = pu.payments?.captures?.[0];
      if (!row || !cap) continue;
      const flipped = await d.transaction(async (tx) => {
        if (row.householdId) await tx.select({ id: schema.households.id }).from(schema.households).where(eq(schema.households.id, row.householdId)).for("share");
        const [f] = await tx
          .update(schema.payments)
          .set({ status: "captured", captureId: cap.id ?? null, payerName: payer, capturedAt: now })
          .where(and(eq(schema.payments.id, row.id), ne(schema.payments.status, "captured")))
          .returning({ id: schema.payments.id, archivedAt: schema.payments.archivedAt });
        // Only a payment of the page's current round counts toward its need.
        if (f && row.needId && !f.archivedAt) {
          await tx
            .update(schema.needs)
            .set({
              funded: sql`${schema.needs.funded} + ${row.amount}`,
              status: sql`case when ${schema.needs.funded} + ${row.amount} >= ${schema.needs.amount} then 'paid' else 'partial' end`,
            })
            .where(and(eq(schema.needs.id, row.needId), isNull(schema.needs.archivedAt)));
        }
        return f ?? null;
      });
      if (!flipped) continue;
      flippedHere.push({ reference_id: row.referenceId, capture_id: cap.id ?? null, amount: cap.amount?.value ?? null, payee: row.payeeName });
    }
  };
  await apply(body);
  let after = await d.select().from(schema.payments).where(eq(schema.payments.orderId, orderId));
  if (after.some((r) => r.status !== "captured") && !(body.purchase_units ?? []).some((pu) => pu.payments?.captures?.length)) {
    const full = await paypalRest<PayPalOrder>(`/v2/checkout/orders/${orderId}`, { method: "GET" });
    if (full.body.status === "COMPLETED") {
      await apply(full.body);
      after = await d.select().from(schema.payments).where(eq(schema.payments.orderId, orderId));
    }
  }
  // A repeated answer that arrived before the first call wrote its captures: wait for them rather than report none.
  if (!after.some((r) => r.status === "captured")) after = (await waitForCaptured(orderId)) ?? after;
  const captures = lines(after.filter((r) => r.status === "captured"));
  // The ledger gets one entry per capture, from whichever call recorded it.
  if (flippedHere.length) {
    await audit(actor, "paypal.order.captured", `order:${orderId}`, { captures: flippedHere.map((c) => ({ ref: c.reference_id, capture: c.capture_id, amount: c.amount })) });
    log.info("order captured", { orderId, captures: flippedHere.map((c) => c.capture_id), actor });
    // Tell the organizer's webhook (a Zapier Catch Hook, say) without holding up the giver's thank-you.
    void notifyGift(orderId, publicOrigin()).catch(() => undefined);
  }
  return { kind: "captured", captures, payerFirstName: g?.given_name ?? null, status: body.status ?? "COMPLETED" };
}

/** Read this order's payments until another call has recorded them as captured, for up to about three seconds. */
async function waitForCaptured(orderId: string, tries = 6, everyMs = 500) {
  for (let i = 0; i < tries; i++) {
    await new Promise((r) => setTimeout(r, everyMs));
    const rows = await db().select().from(schema.payments).where(eq(schema.payments.orderId, orderId));
    if (rows.length && rows.every((r) => r.status === "captured")) return rows;
  }
  return null;
}

const lines = (rows: PaymentRow[]): CaptureLine[] => rows.map((r) => ({ reference_id: r.referenceId, capture_id: r.captureId, amount: r.amount, payee: r.payeeName }));

const PLAIN: Record<string, string> = {
  INSTRUMENT_DECLINED: "That payment method was declined, so nothing was charged. Please choose another one in PayPal.",
  ORDER_NOT_APPROVED: "PayPal has not approved this payment yet, so nothing was charged.",
  ORDER_ALREADY_CAPTURED: "This payment is already complete.",
  PAYER_ACTION_REQUIRED: "PayPal needs one more step from the payer. Please try again.",
};
