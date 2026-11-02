// End to end through the app's own API: "Give any amount" -> one routed PayPal order -> sandbox card -> capture -> receipt.
// Needs the dev server (BASE, default http://localhost:3100). The card stands in for the buyer's PayPal approval.
import { paypalRest } from "../src/lib/paypal/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const amount = Number(process.argv[2] ?? 1500);

async function api(path: string, body?: unknown) {
  const r = await fetch(`${BASE}${path}`, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
}

async function main() {
  await api("/api/demo/reset", { slug: "maya" });
  const created = await api("/api/paypal/gift-orders", { slug: "maya", amount });
  if (created.status !== 200) throw new Error(`create ${created.status} ${JSON.stringify(created.json)}`);
  const { id, plan } = created.json.data;
  console.log("order", id, "lines", plan.lines.map((l: { payeeName: string; amount: number }) => `${l.payeeName} ${l.amount}`).join(" | "));
  console.log("check as cash", plan.checkIfCash, "routed", plan.checkWithRouting);

  const confirm = await paypalRest<{ status?: string }>(`/v2/checkout/orders/${id}/confirm-payment-source`, {
    method: "POST",
    body: JSON.stringify({ payment_source: { card: { number: "4012888888881881", expiry: "2030-12", name: "Joe Ortiz", security_code: "123" } } }),
  });
  console.log("confirm", confirm.status, confirm.body.status);

  const cap = await api(`/api/paypal/orders/${id}/capture`, {});
  console.log("capture", cap.status, JSON.stringify(cap.json?.data?.captures ?? cap.json));
  const again = await api(`/api/paypal/orders/${id}/capture`, {});
  console.log("second capture (idempotent)", again.status, "already:", again.json?.data?.already);

  const live = await api(`/api/paypal/orders/${id}`);
  console.log("live", live.status, live.json?.data?.status, live.json?.data?.units?.length, "units");
  const receipt = await fetch(`${BASE}/r/${id}`);
  console.log("receipt", receipt.status, `${BASE}/r/${id}`);
  const ledger = await api("/api/ledger/verify");
  console.log("ledger", JSON.stringify(ledger.json?.data));
}

main().catch((e) => {
  console.error("FAILED", e.message);
  process.exit(1);
});
