import { fail, ok } from "@/lib/api/envelope";
import { batchRows, syncBatch } from "@/lib/paypal/payouts";
import { reportedTransactions } from "@/lib/paypal/reporting";

/**
 * GET /api/org/payouts/{batchId}: the batch as PayPal reports it now, each item's status, and whether each paid item
 * already appears in PayPal's Transaction Search report.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const started = Date.now();
  const { batchId } = await params;
  if (!/^[A-Z0-9]{8,30}$/.test(batchId)) return fail("invalid_request", "That is not a PayPal payout batch id.", 400);
  if ((await batchRows(batchId)).length === 0) return fail("not_found", "No payout batch with that id was sent from Giftwise.", 404);
  const synced = await syncBatch(batchId);
  const rows = await batchRows(batchId);
  const report = await reportedTransactions(rows[0].createdAt);
  return ok(
    {
      batch_id: batchId,
      batch_status: synced.ok ? synced.batchStatus : "UNKNOWN",
      items: rows.map((r) => ({
        household_id: r.householdId,
        title: r.title,
        payee: r.payeeName,
        route: r.route,
        amount: Number(r.amount),
        status: r.status,
        item_id: r.itemId,
        transaction_id: r.transactionId,
        in_paypal_report: r.transactionId ? (report.ids.has(r.transactionId) ? "found" : report.ok ? "waiting" : "unavailable") : "waiting",
      })),
    },
    started,
    { source: "PayPal Payouts and Transaction Search, live" },
  );
}
