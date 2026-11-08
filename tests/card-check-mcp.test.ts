import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpCallResult, PayPalMcpClient } from "@/lib/agent/paypal-mcp";

/** PayPal's MCP server, faked: whatever get_order should answer, and a record of every call. */
const fake = vi.hoisted(() => ({ answer: null as unknown, calls: [] as { name: string; args: Record<string, unknown> }[], closed: 0, fail: false }));
vi.mock("@/lib/agent/paypal-mcp", () => ({
  connectPayPalMcp: async (): Promise<PayPalMcpClient> => {
    if (fake.fail) throw new Error("PayPal MCP initialize timed out");
    return {
      via: "local",
      version: "1.8.1",
      tools: async () => [],
      call: async (name, args): Promise<McpCallResult> => {
        fake.calls.push({ name, args });
        return fake.answer as McpCallResult;
      },
      close: () => {
        fake.closed++;
      },
    };
  },
}));

const { confirmViaPayPalMcp } = await import("@/lib/card-check");

const planned = [
  { referenceId: "need-1", amount: 30, payeeEmail: "riverside@example.com", payeeName: "Riverside Mobility Repair" },
  { referenceId: "able-savings", amount: 10, payeeEmail: "able@example.com", payeeName: "Maya's ABLE account" },
];
const order = (riversideGot = "30.00") => ({
  id: "43P16739DB3599026",
  status: "COMPLETED",
  purchase_units: [
    { reference_id: "need-1", payee: { email_address: "riverside@example.com" }, payments: { captures: [{ id: "C1", status: "COMPLETED", amount: { value: riversideGot } }] } },
    { reference_id: "able-savings", payee: { email_address: "able@example.com" }, payments: { captures: [{ id: "C2", status: "COMPLETED", amount: { value: "10.00" } }] } },
  ],
});
const text = (v: unknown): McpCallResult => ({ content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v) }] });

beforeEach(() => {
  fake.calls = [];
  fake.closed = 0;
  fake.fail = false;
});

describe("the card check reads the paid order back through PayPal's MCP server", () => {
  it("asks get_order, the one read tool, and agrees when PayPal's copy matches the routing", async () => {
    fake.answer = text(order());
    expect(await confirmViaPayPalMcp("43P16739DB3599026", planned)).toEqual({ via: "@paypal/mcp 1.8.1", ok: true, detail: "agrees on every unit" });
    expect(fake.calls).toEqual([{ name: "get_order", args: { id: "43P16739DB3599026" } }]);
    expect(fake.closed).toBe(1);
  });

  it("fails the check when PayPal's MCP copy disagrees", async () => {
    fake.answer = text(order("3.00"));
    expect(await confirmViaPayPalMcp("43P16739DB3599026", planned)).toMatchObject({ ok: false, detail: "need-1: captured 3.00, routed 30.00" });
  });

  it("notes, without failing, a server that cannot run the call or cannot be reached", async () => {
    fake.answer = { ...text({ ok: false, code: "PAYPAL_API_SETUP_ERROR" }), isError: true };
    expect(await confirmViaPayPalMcp("43P16739DB3599026", planned)).toMatchObject({ ok: null, detail: "get_order answered PAYPAL_API_SETUP_ERROR" });
    fake.answer = text("Internal error");
    expect(await confirmViaPayPalMcp("43P16739DB3599026", planned)).toMatchObject({ ok: null, detail: "get_order answered an error" });
    fake.fail = true;
    expect(await confirmViaPayPalMcp("43P16739DB3599026", planned)).toMatchObject({ ok: null, detail: "not reached (timed out)" });
  });
});
