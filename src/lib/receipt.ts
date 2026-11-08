import { asc, eq, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "./db";

/**
 * Everything a receipt (/r/{orderId}) shows, read by the order id: its payment rows, the page, the needs they paid
 * toward and the ledger entries that name the order. A reset of the sample page never deletes these, so a receipt
 * from an earlier round opens as it did, with `earlierRound` set so the page can say so.
 */
export async function loadReceipt(orderId: string) {
  const d = db();
  const rows = await d.select().from(schema.payments).where(eq(schema.payments.orderId, orderId)).orderBy(asc(schema.payments.id));
  if (rows.length === 0) return null;
  const needIds = rows.flatMap((r) => (r.needId ? [r.needId] : []));
  const [[household], needs, events] = await Promise.all([
    rows[0].householdId ? d.select().from(schema.households).where(eq(schema.households.id, rows[0].householdId)).limit(1) : Promise.resolve([]),
    needIds.length ? d.select().from(schema.needs).where(inArray(schema.needs.id, needIds)) : Promise.resolve([]),
    d
      .select()
      .from(schema.auditEvents)
      .where(or(eq(schema.auditEvents.ref, `order:${orderId}`), sql`${schema.auditEvents.detail}->>'orderId' = ${orderId}`))
      .orderBy(asc(schema.auditEvents.id)),
  ]);
  return { rows, household: household as typeof schema.households.$inferSelect | undefined, needs, events, earlierRound: rows.some((r) => r.archivedAt !== null) };
}
