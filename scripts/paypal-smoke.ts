// Smoke test: create a sandbox order whose payee is the shop account. Prints ids and status only.
import { createPayeeOrder, describePayPalError, readOrder } from "../src/lib/paypal/orders";

async function main() {
  try {
    const o = await createPayeeOrder({
      amount: 420,
      payeeEmail: process.env.PAYPAL_VENDOR_EMAIL!.trim(),
      description: "Wheelchair repair for Maya (Giftwise smoke test)",
      referenceId: "smoke-wheelchair",
      requestId: `smoke-${Date.now()}`,
    });
    console.log("order created:", o.id, "status:", o.status);
    // Read back over REST, as every order read in Giftwise is (src/lib/paypal/orders.ts readOrder).
    const r = await readOrder(o.id!);
    if (!r.ok) throw new Error(`read back failed: ${r.status} ${r.issue}`);
    const pu = r.order.purchase_units?.[0];
    console.log(
      "payee on order:",
      pu?.payee?.email_address === process.env.PAYPAL_VENDOR_EMAIL!.trim() ? "the shop account (correct)" : "another account",
      "| merchant id present:",
      Boolean(pu?.payee?.merchant_id),
    );
    console.log("approve link present:", Boolean(r.order.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")));
  } catch (e) {
    const d = describePayPalError(e);
    console.log("FAILED", d.status, d.issue, d.debugId);
  }
}
main();
