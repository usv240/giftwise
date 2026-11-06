import { describe, expect, it } from "vitest";
import { acceptRequestId, log, logLine, mask, maskEmail, maskText, runWithRequest, setLogSink } from "@/lib/log";
import { scrubEvent } from "@/lib/scrub";

describe("the logger masks what must never be written", () => {
  it("emails keep their first letter and domain", () => {
    expect(maskEmail("Write to maya.rivera@example.org today")).toBe("Write to m***@example.org today");
  });
  it("phone numbers and photo bytes become markers, long text is cut", () => {
    expect(maskText("call (415) 555-0134 or +1 415.555.0134")).toBe("call [phone] or [phone]");
    expect(maskText(`data:image/jpeg;base64,${"A".repeat(400)}`)).toBe("[bytes]");
    expect(maskText("word ".repeat(100))).toMatch(/\(500 chars\)$/);
    // PayPal order ids and dates are not phone numbers.
    expect(maskText("order 5AB12345XY678901K on 2026-11-06")).toBe("order 5AB12345XY678901K on 2026-11-06");
  });
  it("secret keys are hidden by name, payees and amounts by role", () => {
    const out = mask({ apiKey: "gw_test_abc", Authorization: "Bearer x", payee_email: "shop@example.com", payeeName: "Riverside Pharmacy", amount: "42.50", total: 100, orderId: "5AB1", photo: "....", nested: { webhook_url: "https://hooks.example.com/x", ok: true } }) as Record<string, unknown>;
    expect(out).toEqual({ apiKey: "[hidden]", Authorization: "[hidden]", payee_email: "s***@example.com", payeeName: "[payee]", amount: "[amount]", total: "[amount]", orderId: "5AB1", photo: "[hidden]", nested: { webhook_url: "[hidden]", ok: true } });
  });
  it("errors keep a short masked stack", () => {
    const e = new Error("failed for jo@example.com");
    const out = mask(e) as { name: string; message: string; stack?: string };
    expect(out.name).toBe("Error");
    expect(out.message).toBe("failed for j***@example.com");
    expect((out.stack ?? "").split("\n").length).toBeLessThanOrEqual(6);
  });
  it("writes one JSON line with the request id and route of the request it runs in", async () => {
    const lines: string[] = [];
    setLogSink((l) => lines.push(l));
    try {
      await runWithRequest({ requestId: "req_abc", route: "/api/v1/check-gift", started: Date.now() }, async () => {
        log.info("order captured", { orderId: "5AB1", payee: "shop@example.com", err: new Error("x") });
      });
      logLine("warn", "outside", { amount: 3 });
    } finally {
      setLogSink(null);
    }
    expect(lines).toHaveLength(2);
    const a = JSON.parse(lines[0]);
    expect(a).toMatchObject({ level: "info", msg: "order captured", request_id: "req_abc", route: "/api/v1/check-gift", orderId: "5AB1", payee: "s***@example.com" });
    expect(typeof a.ms).toBe("number");
    expect(a.err.message).toBe("x");
    expect(JSON.parse(lines[1])).toMatchObject({ level: "warn", request_id: null, route: null, amount: "[amount]" });
  });
  it("keeps a plain incoming request id and replaces anything else", () => {
    expect(acceptRequestId("req_1234567890abcdef")).toBe("req_1234567890abcdef");
    expect(acceptRequestId("<script>")).toMatch(/^req_[0-9a-f]{20}$/);
    expect(acceptRequestId(null)).toMatch(/^req_[0-9a-f]{20}$/);
  });
  it("scrubs an error-tracking event the same way", () => {
    const ev = scrubEvent({ message: "jo@example.com failed", exception: { values: [{ value: "phone 415-555-0134" }] }, request: { cookies: "a=b", data: "{}", headers: { Cookie: "x", "User-Agent": "ua" }, url: "https://g/x?email=jo@example.com" }, user: { ip: "1.2.3.4" }, extra: { payee: "Shop" } });
    expect(ev.message).toBe("j***@example.com failed");
    expect((ev.exception as { values: { value: string }[] }).values[0].value).toBe("phone [phone]");
    const r = ev.request as Record<string, unknown>;
    expect(r.cookies).toBeUndefined();
    expect(r.data).toBeUndefined();
    expect(r.headers).toEqual({ "User-Agent": "ua" });
    expect(ev.user).toBeUndefined();
    expect(ev.extra).toEqual({ payee: "[payee]" });
  });
});
