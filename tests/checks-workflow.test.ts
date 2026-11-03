import { afterEach, describe, expect, it, vi } from "vitest";
import { API, PATH, Transient, runAll, withRetry, type CheckResult, type Env } from "../workflows/src/checks";

const e: Env = { app: "https://giftwise.example", secret: "s" };
const pass = (id: string, group: CheckResult["group"]): CheckResult => ({ id, group, title: id, ok: true, detail: "", ms: 1, attempts: 1 });

afterEach(() => vi.unstubAllGlobals());

describe("the outside checks workflow", () => {
  it("fans out one check per failure case, page and API promise, all at once", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ data: [{ id: "declined", title: "Declined" }, { id: "double", title: "Double" }] })));
    let inFlight = 0;
    let peak = 0;
    const slow = async <T,>(v: T) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return v;
    };
    const results = await runAll(e, {
      runCase: (id) => slow(pass(`case:${id}`, "case")),
      checkPage: (id) => slow(pass(`path:${id}`, "path")),
      checkApi: (id) => slow(pass(`api:${id}`, "api")),
    });
    expect(results).toHaveLength(2 + PATH.length + API.length);
    expect(peak).toBe(results.length);
  });

  it("records a check that still fails after its retries, instead of dropping it", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ data: [{ id: "declined", title: "Declined" }] })));
    const results = await runAll(e, {
      runCase: async () => {
        throw new Error("PayPal sandbox timed out");
      },
      checkPage: async (id) => pass(`path:${id}`, "path"),
      checkApi: async (id) => pass(`api:${id}`, "api"),
    });
    const c = results.find((r) => r.id === "case:declined");
    expect(c).toMatchObject({ ok: false, group: "case", title: "Declined" });
    expect(c?.detail).toMatch(/Did not finish after retries: PayPal sandbox timed out/);
  });

  it("retries network and 5xx failures with backoff, but not wrong answers", async () => {
    let calls = 0;
    const r = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Transient("HTTP 503");
        return { id: "x", group: "api" as const, title: "x", ok: true, detail: "", ms: 1 };
      },
      2,
      1,
    );
    expect(r.attempts).toBe(3);
    await expect(withRetry(async () => Promise.reject(new Error("bad answer")), 2, 1)).rejects.toThrow("bad answer");
  });
});
