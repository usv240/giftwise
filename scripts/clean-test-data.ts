// Remove what the local test suites create, so they can run again the same day without hitting the daily limits:
// developer keys with @example.com emails, gift pages whose organizer is "E2E", and the local log rows that count toward
// the five-pages-a-day limit. The hash-chained audit ledger is never touched.
// Usage: npm run test:clean
import { and, eq, inArray, like } from "drizzle-orm";
import { db, schema } from "../src/lib/db";

async function main() {
  const d = db();
  const keys = await d.select({ id: schema.apiKeys.id }).from(schema.apiKeys).where(like(schema.apiKeys.email, "%@example.com"));
  const keyIds = keys.map((k) => k.id);
  if (keyIds.length) {
    await d.delete(schema.apiRequests).where(inArray(schema.apiRequests.keyId, keyIds));
    await d.delete(schema.apiKeys).where(inArray(schema.apiKeys.id, keyIds));
  }

  const pages = await d.select({ id: schema.households.id }).from(schema.households).where(and(eq(schema.households.isSample, false), eq(schema.households.caregiverName, "E2E")));
  const pageIds = pages.map((p) => p.id);
  if (pageIds.length) {
    await d.delete(schema.payments).where(inArray(schema.payments.householdId, pageIds));
    await d.delete(schema.payouts).where(inArray(schema.payouts.householdId, pageIds));
    await d.delete(schema.needs).where(inArray(schema.needs.householdId, pageIds));
    await d.delete(schema.households).where(inArray(schema.households.id, pageIds));
  }

  // The gift-pages log rows in this local database, which count toward the five-a-day limit. Run against a local database only.
  await d.delete(schema.apiRequests).where(eq(schema.apiRequests.endpoint, "gift-pages"));
  // The same for payout batches, which are limited to three a day per visitor.
  await d.delete(schema.apiRequests).where(eq(schema.apiRequests.endpoint, "org-payouts"));
  console.log(`Removed ${keyIds.length} test keys and ${pageIds.length} test gift pages, and reset the local gift-page count.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
