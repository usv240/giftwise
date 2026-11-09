import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import recorded from "../content/sample-receipt.json";

/**
 * PayPal's answer to GET /v2/checkout/orders/{id} for the recorded sample order (content/sample-receipt.json), in the
 * shape PayPal sent it on November 9, 2026: four purchase units to three payees, each unit with a shipping name and an
 * empty shipping address. Emails, names and links are masked; the ids, amounts and statuses are PayPal's own.
 */
const unit = (ref: string, value: string, payee: string, capture: string) => ({
  reference_id: ref,
  amount: { currency_code: "USD", value, breakdown: { item_total: { currency_code: "USD", value }, shipping: { currency_code: "USD", value: "0.00" } } },
  payee: { email_address: `${payee}@business.example.com`, merchant_id: "[masked]" },
  description: ref,
  items: [{ name: ref, unit_amount: { currency_code: "USD", value }, tax: { currency_code: "USD", value: "0.00" }, quantity: "1" }],
  shipping: { name: { full_name: "[masked]" }, address: {} },
  payments: {
    captures: [
      {
        id: capture,
        status: "COMPLETED",
        amount: { currency_code: "USD", value },
        final_capture: true,
        seller_protection: { status: "ELIGIBLE", dispute_categories: ["ITEM_NOT_RECEIVED", "UNAUTHORIZED_TRANSACTION"] },
        create_time: "2026-11-09T01:02:01Z",
        update_time: "2026-11-09T01:02:01Z",
      },
    ],
  },
});
const ACCOUNT: Record<string, string> = { "vendor:eastgate": "sb-eastgate", "vendor:northside": "sb-northside", able: "sb-able" };
const PAYPAL_ANSWER = {
  id: recorded.order_id,
  intent: "CAPTURE",
  status: "COMPLETED",
  payment_source: { paypal: { email_address: "sb-buyer@personal.example.com", account_status: "VERIFIED", address: { country_code: "US" } } },
  purchase_units: recorded.lines.map((l) => unit(l.reference_id, l.amount, ACCOUNT[l.payee_account], l.capture_id)),
  links: [{ href: "[masked link]", rel: "self", method: "GET" }],
};

const rest = vi.hoisted(() => ({ calls: [] as string[], answer: { status: 200, body: {} as unknown, debugId: "f00d" } }));
vi.mock("@/lib/paypal/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/paypal/client")>()),
  paypalConfigured: () => true,
  paypalRest: vi.fn(async (p: string) => {
    rest.calls.push(p);
    return rest.answer;
  }),
}));

describe("reading a captured multi-payee order", () => {
  it("the Server SDK's own order schema turns PayPal's answer away, for the empty shipping address", async () => {
    // The SDK checks every answer against this schema before it hands it back; this is the ResponseValidationError
    // "Check with PayPal now" used to end in. Without the empty address, the same answer passes.
    const req = createRequire(import.meta.url);
    const { validateAndMap } = req("@apimatic/schema") as { validateAndMap: (v: unknown, s: unknown) => { errors: false | { path: (string | number)[] }[] } };
    const { orderSchema } = req(path.resolve("node_modules/@paypal/paypal-server-sdk/dist/cjs/models/order.js"));
    const errors = validateAndMap(PAYPAL_ANSWER, orderSchema).errors || [];
    expect(errors.map((e) => e.path.join("."))).toContain("purchase_units.0.shipping.address");
    const withoutAddress = JSON.parse(JSON.stringify(PAYPAL_ANSWER));
    for (const pu of withoutAddress.purchase_units) delete pu.shipping.address;
    expect(validateAndMap(withoutAddress, orderSchema).errors).toBe(false);
  });

  it("readOrder reads it over REST, and orderView keeps every unit, payee and capture", async () => {
    const { orderView, readOrder } = await import("@/lib/paypal/orders");
    rest.answer = { status: 200, body: PAYPAL_ANSWER, debugId: "f00d" };
    const r = await readOrder(recorded.order_id);
    expect(rest.calls.at(-1)).toBe(`/v2/checkout/orders/${recorded.order_id}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const v = orderView(r.order);
    expect(v.status).toBe("COMPLETED");
    expect(v.units.map((u) => u.reference_id)).toEqual(recorded.lines.map((l) => l.reference_id));
    expect(v.units.map((u) => u.captures[0])).toEqual(recorded.lines.map((l) => ({ id: l.capture_id, status: "COMPLETED", amount: l.amount })));
    // Four purchase units, three payees: the ABLE account is paid on two lines.
    expect(new Set(v.units.map((u) => u.payee_email)).size).toBe(3);
  });

  it("GET /api/paypal/orders/{id} answers 200 COMPLETED for it", async () => {
    rest.answer = { status: 200, body: PAYPAL_ANSWER, debugId: "f00d" };
    const { GET } = await import("@/app/api/paypal/orders/[id]/route");
    const res = await GET(new Request(`http://local/api/paypal/orders/${recorded.order_id}`), { params: Promise.resolve({ id: recorded.order_id }) });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.status).toBe("COMPLETED");
    expect(j.data.units).toHaveLength(recorded.lines.length);
    expect(j.meta.source).toBe("PayPal Orders v2, live");
  });

  it("a 5xx from PayPal is read again, and one that persists answers 502 with PayPal's issue", async () => {
    const { readOrder } = await import("@/lib/paypal/orders");
    const before = rest.calls.length;
    rest.answer = { status: 500, body: { name: "INTERNAL_SERVER_ERROR", debug_id: "e500" }, debugId: "e500" };
    const r = await readOrder(recorded.order_id, { retryMs: 1 });
    expect(rest.calls.length - before).toBe(3);
    expect(r).toMatchObject({ ok: false, status: 502, issue: "INTERNAL_SERVER_ERROR", debugId: "e500" });
  });

  it("a PayPal refusal keeps its status and issue, in plain words", async () => {
    rest.answer = { status: 404, body: { name: "RESOURCE_NOT_FOUND", details: [{ issue: "INVALID_RESOURCE_ID" }], debug_id: "abc" }, debugId: "abc" };
    const { GET } = await import("@/app/api/paypal/orders/[id]/route");
    const res = await GET(new Request("http://local/api/paypal/orders/0000000000000000X"), { params: Promise.resolve({ id: "0000000000000000X" }) });
    expect(res.status).toBe(404);
    const j = await res.json();
    expect(j.error.code).toBe("not_found");
    expect(j.error.details.issue).toBe("INVALID_RESOURCE_ID");
  });
});
