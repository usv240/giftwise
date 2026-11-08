// Probe: may this app onboard a shop through PayPal's Partner Referrals API v2 in the sandbox? One create call with the
// app's own sandbox credentials. A created referral returns an action_url for the shop to sign up; a refusal returns
// PayPal's status and name, which content/real-world.json records. Prints no credentials.
// Usage: npx tsx --env-file=.env.local scripts/partner-referrals-probe.ts
import { paypalRest } from "../src/lib/paypal/client";

async function main() {
  const res = await paypalRest<{ name?: string; message?: string; links?: { rel: string; href: string }[]; details?: { issue?: string }[] }>("/v2/customer/partner-referrals", {
    method: "POST",
    body: JSON.stringify({
      tracking_id: `giftwise-shop-${Date.now()}`,
      operations: [{ operation: "API_INTEGRATION", api_integration_preference: { rest_api_integration: { integration_method: "PAYPAL", integration_type: "THIRD_PARTY", third_party_details: { features: ["PAYMENT", "REFUND"] } } } }],
      products: ["EXPRESS_CHECKOUT"],
      legal_consents: [{ type: "SHARE_DATA_CONSENT", granted: true }],
    }),
  });
  const action = res.body.links?.find((l) => l.rel === "action_url")?.href;
  console.log(JSON.stringify({ at: new Date().toISOString(), status: res.status, name: res.body.name ?? null, message: res.body.message ?? null, issue: res.body.details?.[0]?.issue ?? null, debug_id: res.debugId, action_url: action ? "returned" : null }));
}
void main();
