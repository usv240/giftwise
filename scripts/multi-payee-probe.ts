// Probe: one PayPal order, two purchase units, two different payees (shop + ABLE). Card-funded so no buyer login is needed.
import { CheckoutPaymentIntent, orders } from "../src/lib/paypal/client";
import { describePayPalError } from "../src/lib/paypal/orders";
async function main() {
  const shop = process.env.PAYPAL_VENDOR_EMAIL!.trim(), able = process.env.PAYPAL_ABLE_EMAIL!.trim();
  try {
    const { result } = await orders().createOrder({
      paypalRequestId: `multi-${Date.now()}`,
      prefer: "return=representation",
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [
          { referenceId: "shower-chair", description: "Shower chair", amount: { currencyCode: "USD", value: "189.00" }, payee: { emailAddress: shop } },
          { referenceId: "able", description: "To her ABLE account", amount: { currencyCode: "USD", value: "111.00" }, payee: { emailAddress: able } },
        ],
        paymentSource: { card: { number: "4012888888881881", expiry: "2030-12", name: "Joe Ortiz", securityCode: "123" } },
      },
    });
    console.log("order", result.id, result.status);
    for (const pu of result.purchaseUnits ?? []) {
      const c = pu.payments?.captures?.[0];
      console.log(" unit", pu.referenceId, "payee ok:", pu.payee?.emailAddress === (pu.referenceId === "able" ? able : shop), "| capture", c?.id, c?.status, c?.amount?.value);
    }
  } catch (e) {
    const d = describePayPalError(e);
    console.log("FAILED", d.status, d.issue, d.debugId);
  }
}
main();
