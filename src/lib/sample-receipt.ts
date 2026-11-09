import { and, eq } from "drizzle-orm";
import recorded from "../../content/sample-receipt.json";
import { db, schema } from "./db";

export type RecordedLine = { reference_id: string; need_index: number | null; payee_name: string; payee_account: string; route: string; amount: string; capture_id: string };
export type RecordedReceipt = { about: string; recorded_at: string; source: string; order_id: string; captured_at: string; payer_first_name: string; lines: RecordedLine[] };

/**
 * One captured sandbox order from a real `npm run e2e:paypal` run, kept in content/sample-receipt.json so its receipt
 * (/r/{order_id}) can be read on any deployment without paying. It is seeded with the sample household as an earlier
 * round, so it never counts toward Maya's open needs, her totals or her report; the receipt labels it as recorded.
 */
export const RECORDED_RECEIPT = recorded as RecordedReceipt;

/**
 * Put the recorded order's payment rows in place for the sample household, once: each line points at the sample need
 * in its position (so the receipt names what was paid for) and is archived at its capture time, which is what marks a
 * payment as an earlier round. A row that is already there is left as it is. `resolve` gives the sandbox account a
 * line was paid to when this server knows it (src/lib/households.ts payeeEmail); the receipt never shows an address.
 */
export async function seedRecordedReceipt(householdId: number, needs: { id: number; sortOrder: number }[], resolve: (account: string) => string) {
  const accountEmail = (account: string) => {
    try {
      return resolve(account);
    } catch {
      return "";
    }
  };
  const d = db();
  const [exists] = await d.select({ id: schema.payments.id }).from(schema.payments).where(eq(schema.payments.orderId, RECORDED_RECEIPT.order_id)).limit(1);
  if (exists) return false;
  const capturedAt = new Date(RECORDED_RECEIPT.captured_at);
  await d
    .insert(schema.payments)
    .values(
      RECORDED_RECEIPT.lines.map((l) => ({
        needId: l.need_index === null ? null : (needs.find((n) => n.sortOrder === l.need_index)?.id ?? null),
        householdId,
        orderId: RECORDED_RECEIPT.order_id,
        referenceId: l.reference_id,
        payeeName: l.payee_name,
        route: l.route,
        captureId: l.capture_id,
        status: "captured",
        amount: l.amount,
        payeeEmail: accountEmail(l.payee_account),
        payerName: RECORDED_RECEIPT.payer_first_name,
        createdAt: capturedAt,
        capturedAt,
        archivedAt: capturedAt,
      })),
    )
    .onConflictDoNothing();
  return true;
}

/** The sample household's needs by position, for the seed: the sample's rows carry sort_order 0 to 3. */
export async function sampleNeedPositions(householdId: number) {
  return db()
    .select({ id: schema.needs.id, sortOrder: schema.needs.sortOrder })
    .from(schema.needs)
    .where(and(eq(schema.needs.householdId, householdId)));
}
