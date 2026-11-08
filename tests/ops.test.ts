import { describe, expect, it } from "vitest";
import { ago, liveSummary, mcpCheck, optionalOffSentence, type Check } from "@/lib/health";
import { checkPaymentsOf, describeCheckPayments, foldStatus, shortId } from "@/lib/ops";

describe("the operations page shortens ids before they leave", () => {
  it("keeps the kind and the ends of the id", () => {
    expect(shortId("order:5AB12345XY678901K")).toBe("order:5AB1…01K");
    expect(shortId("household:12")).toBe("household:12");
    expect(shortId("render-task-run:abcdefgh")).toBe("render-task-run:abc…gh");
    expect(shortId("runner")).toBe("runner");
  });
});

describe("payments by status", () => {
  it("folds PayPal's and Giftwise's words into five plain ones", () => {
    expect(["created", "captured", "SUCCESS", "PENDING", "UNCLAIMED", "refunded", "REVERSED", "declined", "failed", "BLOCKED"].map(foldStatus)).toEqual([
      "planned",
      "paid",
      "paid",
      "waiting",
      "waiting",
      "returned",
      "returned",
      "failed",
      "failed",
      "failed",
    ]);
  });
  it("names the outside checks' test payments in plain words instead of counting them as failed gifts", () => {
    // One nightly run: a declined test card, a capture tried before approval, and two paid $12 orders.
    const c = checkPaymentsOf([
      { status: "declined", n: 1 },
      { status: "failed", n: 1 },
      { status: "captured", n: 2 },
    ]);
    expect(c).toEqual({ declined: 1, refused: 1, paid: 2, other: 0 });
    expect(describeCheckPayments(c)).toBe(
      "Not counted above: 4 test payments the outside checks made in the sandbox: 1 test card declined on purpose (the declined-card check), 1 capture refused because the giver had not approved yet (the unapproved-order check) and 2 test orders of $12 paid (the double-click and refund checks).",
    );
    expect(describeCheckPayments(checkPaymentsOf([]))).toBe("");
  });
});

const check = (id: string, mode: Check["mode"], optional = false): Check => ({ id, name: id === "errors" ? "Error tracking" : id, mode, detail: "", optional });

describe("the count of services live", () => {
  it("names an optional service that is off instead of counting it as down", () => {
    const checks = [check("paypal", "live"), check("database", "live"), check("claude", "fallback"), check("errors", "off", true)];
    expect(liveSummary(checks)).toEqual({ live: 2, of: 3, fallback: 1, optionalOff: ["Error tracking"] });
    expect(optionalOffSentence(["Error tracking"])).toBe("Error tracking is optional and off.");
    expect(optionalOffSentence(["Error tracking", "PayPal webhooks"])).toBe("Error tracking and PayPal webhooks are optional and off.");
    expect(optionalOffSentence([])).toBe("");
  });
});

describe("the PayPal MCP server reads the same in /api/health, /status and /ops", () => {
  const now = Date.parse("2026-11-07T20:00:00Z");
  it("reports the last check's answer with when it ran", () => {
    const live = mcpCheck({ at: now - 4 * 60_000, ok: true, detail: "PayPal's @paypal/mcp 1.8.1, run by Giftwise: 30 tools listed; get_order reaches PayPal" }, true, now);
    expect(live.mode).toBe("live");
    expect(live.detail).toBe("PayPal's @paypal/mcp 1.8.1, run by Giftwise: 30 tools listed; get_order reaches PayPal, checked 4 minutes ago");
    expect(live.checkedAt).toBe("2026-11-07T19:56:00.000Z");
    expect(mcpCheck({ at: now, ok: false, detail: "Not reachable (timeout)" }, true, now).mode).toBe("fallback");
  });
  it("says a first check is running rather than calling it a fallback", () => {
    expect(mcpCheck(null, true, now).mode).toBe("checking");
    expect(mcpCheck(null, false, now).mode).toBe("not_connected");
  });
  it("says how long ago in plain words", () => {
    expect(ago(now - 20_000, now)).toBe("just now");
    expect(ago(now - 60_000, now)).toBe("1 minute ago");
    expect(ago(now - 125 * 60_000, now)).toBe("2 hours ago");
  });
});
