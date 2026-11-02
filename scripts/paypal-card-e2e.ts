// End-to-end payment test without a buyer login: a sandbox test card pays the shop directly.
// Exercises the same server pieces the PayPal button uses: order with payee = shop, capture, database, ledger.
import { eq } from "drizzle-orm";
import { CheckoutPaymentIntent, orders } from "../src/lib/paypal/client";
import { describePayPalError } from "../src/lib/paypal/orders";
import { db, schema } from "../src/lib/db";
import { verifyLedger } from "../src/lib/audit";

const B = "http://localhost:3100";

async function main() {
  // 1. Reset the sample so the run is repeatable.
  await fetch(`${B}/api/demo/reset`, { method: "POST" });

  // 2. Card order with the shop as payee (PayPal "pay another account"), captured server-side.
  const need = (await db().select().from(schema.needs).where(eq(schema.needs.title, "Wheelchair repair")).limit(1))[0];
  try {
    const { result } = await orders().createOrder({
      paypalRequestId: `card-e2e-${Date.now()}`,
      prefer: "return=representation",
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [
          {
            referenceId: `need-${need.id}`,
            description: "Wheelchair repair for Maya, paid to Riverside Mobility Repair",
            amount: { currencyCode: "USD", value: Number(need.amount).toFixed(2) },
            payee: { emailAddress: process.env.PAYPAL_VENDOR_EMAIL!.trim() },
          },
        ],
        paymentSource: { card: { number: "4012888888881881", expiry: "2030-12", name: "Dan Ortiz", securityCode: "123" } },
      },
    });
    console.log("card order:", result.id, result.status);
    const capture = result.purchaseUnits?.[0]?.payments?.captures?.[0];
    console.log("capture:", capture?.id, capture?.status, capture?.amount?.value, "| payee correct:", result.purchaseUnits?.[0]?.payee?.emailAddress === process.env.PAYPAL_VENDOR_EMAIL!.trim());
    console.log("seller receivable breakdown present:", Boolean(capture?.sellerReceivableBreakdown));
  } catch (e) {
    const d = describePayPalError(e);
    console.log("card payment FAILED", d.status, d.issue, d.debugId);
  }

  // 3. The app's own path: create order via our API, then try capture before approval (expected to be refused).
  const r = await fetch(`${B}/api/paypal/orders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ needId: need.id }) });
  const j = await r.json();
  console.log("app order:", r.status, j.data?.id, "| rules:", j.data?.rule_ids);
  const c = await fetch(`${B}/api/paypal/orders/${j.data?.id}/capture`, { method: "POST" });
  const cj = await c.json();
  console.log("capture before approval:", c.status, cj.error?.details?.issue ?? cj.error?.message);

  // 4. Ledger integrity
  console.log("ledger:", JSON.stringify(await verifyLedger()));
  process.exit(0);
}
main();
