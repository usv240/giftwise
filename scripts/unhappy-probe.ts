// Probe: (1) PayPal negative testing (mock INSTRUMENT_DECLINED on capture), (2) refunding a capture paid to another account.
import { paypalRest } from "../src/lib/paypal/client";

const card = { number: "4012888888881881", expiry: "2030-12", name: "Joe Ortiz", security_code: "123" };
const shop = process.env.PAYPAL_VENDOR_EMAIL!.trim();

async function order(withCard: boolean) {
  return paypalRest<{ id: string; status: string; purchase_units?: { payments?: { captures?: { id: string; status: string }[] } }[] }>("/v2/checkout/orders", {
    method: "POST",
    requestId: `probe-${crypto.randomUUID()}`,
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{ reference_id: "probe", amount: { currency_code: "USD", value: "12.00" }, payee: { email_address: shop } }],
      ...(withCard ? { payment_source: { card } } : {}),
    }),
  });
}

async function main() {
  // 1. Negative test: create, confirm with card, capture with a mock decline.
  const a = await order(false);
  const conf = await paypalRest(`/v2/checkout/orders/${a.body.id}/confirm-payment-source`, { method: "POST", body: JSON.stringify({ payment_source: { card } }) });
  const cap = await paypalRest<{ name?: string; details?: { issue?: string }[] }>(`/v2/checkout/orders/${a.body.id}/capture`, {
    method: "POST",
    requestId: `cap-${a.body.id}`,
    headers: { "PayPal-Mock-Response": JSON.stringify({ mock_application_codes: "INSTRUMENT_DECLINED" }) },
  });
  console.log("decline probe: confirm", conf.status, "| capture", cap.status, cap.body.name, cap.body.details?.[0]?.issue);

  // 2. Refund a capture whose payee is the shop (we are the API caller, not the payee).
  const b = await order(true);
  const capId = b.body.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  console.log("paid order", b.status, b.body.status, "capture", capId);
  if (capId) {
    const ref = await paypalRest<{ status?: string; name?: string; details?: { issue?: string; description?: string }[] }>(`/v2/payments/captures/${capId}/refund`, {
      method: "POST",
      requestId: `refund-${capId}`,
      body: JSON.stringify({ note_to_payer: "The shop could not fill this order." }),
    });
    console.log("refund", ref.status, ref.body.status ?? ref.body.name, ref.body.details?.[0]?.issue ?? "", ref.body.details?.[0]?.description ?? "");
  }
}
main();
