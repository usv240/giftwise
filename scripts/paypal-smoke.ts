// Smoke test: create a sandbox order whose payee is the shop account. Prints ids and status only.
import { createPayeeOrder, describePayPalError, getOrder } from "../src/lib/paypal/orders";

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
    const g = await getOrder(o.id!);
    const pu = g.purchaseUnits?.[0];
    console.log(
      "payee on order:",
      pu?.payee?.emailAddress === process.env.PAYPAL_VENDOR_EMAIL!.trim() ? "the shop account (correct)" : pu?.payee?.emailAddress,
      "| merchant id present:",
      Boolean(pu?.payee?.merchantId),
    );
    console.log("approve link present:", Boolean(g.links?.find((l) => l.rel === "approve" || l.rel === "payer-action")));
  } catch (e) {
    const d = describePayPalError(e);
    console.log("FAILED", d.status, d.issue, d.debugId);
  }
}
main();
