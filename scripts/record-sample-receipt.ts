// Record one captured sandbox order from the local database into content/sample-receipt.json, the receipt that is
// seeded with the sample page so it can be read on any deployment without paying (src/lib/sample-receipt.ts).
//
//   npx tsx --env-file=.env.local scripts/record-sample-receipt.ts <PayPal order id>
//   npx tsx --env-file=.env.local scripts/record-sample-receipt.ts            the latest captured routed gift on Maya's page
//
// Only what the receipt shows is kept: payee names, routes, amounts, capture ids, the payer's first name and the time.
// No email address leaves the database; the payee's sandbox account is named by its key (vendor:riverside, able).
import { writeFileSync } from "node:fs";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "../src/lib/db";
import { SAMPLE } from "../src/lib/households";

const FILE = "content/sample-receipt.json";

async function main() {
  const wanted = process.argv[2];
  const d = db();
  const [maya] = await d.select({ id: schema.households.id }).from(schema.households).where(eq(schema.households.slug, SAMPLE.slug));
  if (!maya) throw new Error("The sample household is not in this database; open /g/maya once.");

  let orderId = wanted;
  if (!orderId) {
    // The latest routed gift (its order has an able-savings line) whose every row was captured.
    const latest = await d
      .select({ orderId: schema.payments.orderId })
      .from(schema.payments)
      .where(and(eq(schema.payments.householdId, maya.id), eq(schema.payments.referenceId, "able-savings"), isNotNull(schema.payments.captureId)))
      .orderBy(desc(schema.payments.capturedAt))
      .limit(1);
    orderId = latest[0]?.orderId;
    if (!orderId) throw new Error("No captured routed gift found; run npm run e2e:paypal first.");
  }

  const rows = await d.select().from(schema.payments).where(eq(schema.payments.orderId, orderId)).orderBy(schema.payments.id);
  if (!rows.length) throw new Error(`No payment rows for order ${orderId}.`);
  if (rows.some((r) => r.status !== "captured" || !r.captureId)) throw new Error(`Order ${orderId} is not fully captured.`);
  const needs = await d.select({ id: schema.needs.id, sortOrder: schema.needs.sortOrder, payeeAccount: schema.needs.payeeAccount }).from(schema.needs).where(eq(schema.needs.householdId, maya.id));
  const capturedAt = rows.find((r) => r.capturedAt)?.capturedAt ?? new Date();

  const out = {
    about:
      "One captured PayPal sandbox order from a real run of npm run e2e:paypal on the sample page, recorded here so a receipt can be read on any deployment without paying. It is seeded with the sample household as an earlier round (archived), so it never counts toward Maya's open needs; it is listed on the report for the month it was captured, so that report's check page asks PayPal for each capture. Check with PayPal now on its receipt asks PayPal's sandbox for this order live. Written by scripts/record-sample-receipt.ts; no email address or key is kept.",
    recorded_at: new Date().toISOString(),
    source: "npm run e2e:paypal, Give any amount, routed across the open needs and the ABLE account",
    order_id: orderId,
    captured_at: capturedAt.toISOString(),
    payer_first_name: rows.find((r) => r.payerName)?.payerName?.split(" ")[0] ?? "A giver",
    lines: rows.map((r) => {
      const need = needs.find((n) => n.id === r.needId);
      return {
        reference_id: r.referenceId,
        need_index: need ? need.sortOrder : null,
        payee_name: r.payeeName,
        payee_account: need?.payeeAccount ?? (r.route === "able" ? "able" : "vendor"),
        route: r.route,
        amount: Number(r.amount).toFixed(2),
        capture_id: r.captureId,
      };
    }),
  };
  writeFileSync(FILE, JSON.stringify(out, null, 2) + "\n");
  console.log(`Recorded order ${orderId} (${out.lines.length} lines, $${out.lines.reduce((s, l) => s + Number(l.amount), 0).toFixed(2)}) to ${FILE}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
