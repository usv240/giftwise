import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A key pasted with a second line once made an SDK throw an error that quoted the request's own headers. Whatever an
 * upstream service or SDK throws, nothing credential-shaped may reach a response, a page or a log line. Every key here
 * is made up.
 */
const FAKE_KEY = "sk-ant-api03-FAKEfake0123456789abcdefFAKEfake0123456789abcdef-AAAA";
const LEAK = `Headers.append: "Bearer ${FAKE_KEY}\nPAYPAL_CLIENT_ID=AbC123dEf456gHi789jKl0" is an invalid header value.`;
const CREDENTIAL = /sk-ant-|AbC123dEf456|PAYPAL_CLIENT_ID=(?!\[redacted\])|Bearer (?!\[redacted\])[A-Za-z0-9]/;

const leak = vi.hoisted(() => ({ thrown: null as Error | null }));

vi.mock("@/lib/ai/claude", async (orig) => {
  const real = await orig<typeof import("@/lib/ai/claude")>();
  return {
    ...real,
    aiAvailable: () => true,
    structured: vi.fn(async () => {
      throw leak.thrown;
    }),
  };
});
vi.mock("@/lib/agent/demo", () => ({
  runAgentDemo: vi.fn(async () => {
    throw leak.thrown;
  }),
}));
// These tests are about redaction. The rate limit and the request log are kept off any database the shell names, so a
// DATABASE_URL that does not answer cannot stall them; the database paths have their own tests.
vi.mock("@/lib/db", async (orig) => ({ ...(await orig<typeof import("@/lib/db")>()), dbConfigured: () => false }));

const lines: string[] = [];
beforeAll(async () => {
  const { setLogSink } = await import("@/lib/log");
  setLogSink((line) => lines.push(line));
});
afterAll(async () => {
  const { setLogSink } = await import("@/lib/log");
  setLogSink(null);
});
beforeEach(() => {
  lines.length = 0;
  leak.thrown = new TypeError(LEAK);
});

describe("redactSecrets", () => {
  it("removes the leaked shape and keeps the plain words around it", async () => {
    const { redactSecrets } = await import("@/lib/scrub");
    const out = redactSecrets(LEAK);
    expect(out).not.toMatch(CREDENTIAL);
    expect(out).toContain("is an invalid header value");
    expect(out).toContain("PAYPAL_CLIENT_ID=[redacted]");
  });
  it("redacts PayPal access tokens and Basic credentials, and leaves ids and amounts alone", async () => {
    const { redactSecrets } = await import("@/lib/scrub");
    expect(redactSecrets("token A21AAFakeFakeFakeFake0123456789")).toBe("token [redacted token]");
    expect(redactSecrets("Basic QWxhZGRpbjpvcGVuc2VzYW1lMTIz")).toBe("Basic [redacted]");
    expect(redactSecrets("Order 43P16739DB3599026 paid $30.00 to Riverside")).toBe("Order 43P16739DB3599026 paid $30.00 to Riverside");
  });
  it("redactDeep reaches every string in a nested value", async () => {
    const { redactDeep } = await import("@/lib/scrub");
    expect(JSON.stringify(redactDeep({ a: [{ b: LEAK }], n: 3 }))).not.toMatch(CREDENTIAL);
  });
});

describe("a leaked error never reaches a visitor", () => {
  it("the bill reader answers in plain words", { timeout: 120_000 }, async () => {
    const { POST } = await import("@/app/api/v1/read-bill/route");
    const form = new FormData();
    form.append("file", new File([Buffer.from("%PDF-1.4\n% made-up bill\n")], "bill.pdf", { type: "application/pdf" }));
    const res = await POST(new Request("http://localhost/api/v1/read-bill", { method: "POST", body: form }));
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(text).not.toMatch(CREDENTIAL);
    expect(JSON.parse(text).error.message).toMatch(/^Something went wrong while reading the bill/);
    // The full error is logged for the operator, masked.
    expect(lines.join("\n")).toContain("read-bill failed");
    expect(lines.join("\n")).not.toMatch(CREDENTIAL);
  });

  it("the agent run answers in plain words", async () => {
    const { POST } = await import("@/app/api/agent-demo/route");
    const res = await POST(new Request("http://localhost/api/agent-demo", { method: "POST" }));
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(text).not.toMatch(CREDENTIAL);
    expect(lines.join("\n")).not.toMatch(CREDENTIAL);
  });

  it("the API envelope redacts data and error text, whatever a handler put in them", async () => {
    const { fail, ok } = await import("@/lib/api/envelope");
    expect(await ok({ note: LEAK }, Date.now()).text()).not.toMatch(CREDENTIAL);
    expect(await fail("internal", LEAK, 500, { upstream: LEAK }).text()).not.toMatch(CREDENTIAL);
  });

  it("a failure shown on a page names its kind, never its text", async () => {
    const { failureKind } = await import("@/lib/scrub");
    expect(failureKind(new TypeError(LEAK))).toBe("an unexpected error");
    expect(failureKind(Object.assign(new Error(LEAK), { status: 502 }))).toBe("answered 502");
    expect(failureKind(Object.assign(new Error(LEAK), { name: "TimeoutError" }))).toBe("timed out");
  });
});

describe("a key with a second line is never used", () => {
  it("is malformed, and /status says so", async () => {
    const real = await vi.importActual<typeof import("@/lib/ai/claude")>("@/lib/ai/claude");
    expect(real.apiKeyState({ ANTHROPIC_API_KEY: `${FAKE_KEY}\nPAYPAL_CLIENT_ID=AbC123dEf456gHi789jKl0` })).toBe("malformed");
    expect(real.apiKeyState({ ANTHROPIC_API_KEY: `  ${FAKE_KEY}  ` })).toBe("ok");
    expect(real.apiKeyState({ ANTHROPIC_API_KEY: "   " })).toBe("missing");
    const { claudeCheck } = await import("@/lib/health");
    const row = claudeCheck(null, "malformed");
    expect(row.mode).toBe("not_connected");
    expect(row.detail).toMatch(/more than one line or a space, so it is not used/);
    expect(claudeCheck({ ok: true, detail: "The API accepted the key; bill and fundraiser reading are live" }, "ok").mode).toBe("live");
    expect(claudeCheck(null, "ok").mode).toBe("checking");
  });
});
