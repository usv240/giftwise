import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API, MCP_TOOLS, NIGHTLY_UTC, PATH, Transient, checkApi, runAll, withRetry, type CheckResult, type Env } from "../workflows/src/checks";
import { TOOLS } from "@/lib/mcp/tools";

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
    // The kind of failure only: an error's own text can quote request headers.
    expect(c?.detail).toMatch(/Did not finish after retries: timed out/);
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

  it("pays a gift with the sandbox test card, then opens its public receipt from outside", async () => {
    const order = "7B80384245260754A";
    const answer = (paid: boolean, receipt: number) => async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u === `${e.app}/api/checks/card-gift`) {
        expect(init?.method).toBe("POST");
        expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${e.secret}`);
        return new Response(JSON.stringify({ data: { ok: paid, order_id: order, evidence: ["$20.00 routed into PayPal order", "PayPal's record: 5 units"] } }));
      }
      if (u === `${e.app}/r/${order}`) return new Response(receipt === 200 ? `<p class="rc-order">Order ${order}</p>` : "Not found", { status: receipt });
      throw new Error(`unexpected ${u}`);
    };
    expect(API.some((a) => a.id === "card-gift")).toBe(true);
    vi.stubGlobal("fetch", answer(true, 200));
    const good = await checkApi(e, "card-gift");
    expect(good).toMatchObject({ id: "api:card-gift", group: "api", ok: true });
    expect(good.detail).toBe(`$20.00 routed into PayPal order | PayPal's record: 5 units | Public receipt /r/${order}: HTTP 200`);
    vi.stubGlobal("fetch", answer(true, 404));
    expect((await checkApi(e, "card-gift")).ok).toBe(false);
    vi.stubGlobal("fetch", answer(false, 200));
    expect((await checkApi(e, "card-gift")).ok).toBe(false);
  });

  it("expects exactly the tools the MCP server lists, and says how many", () => {
    expect([...MCP_TOOLS].sort()).toEqual(TOOLS.map((t) => t.name).sort());
    expect(API.find((a) => a.id === "mcp")?.title).toMatch(/lists its \w+ tools$/);
    expect(API.find((a) => a.id === "mcp")?.title).not.toMatch(/\d/);
  });

  it("runs nightly at the hour render.yaml and TESTING.md give", () => {
    const yaml = readFileSync("render.yaml", "utf8");
    const cron = /name: giftwise-nightly[\s\S]*?schedule: "([^"]+)"/.exec(yaml)?.[1];
    expect(cron).toBe(`${NIGHTLY_UTC.minute} ${NIGHTLY_UTC.hour} * * *`);
    const hh = String(NIGHTLY_UTC.hour).padStart(2, "0");
    const mm = String(NIGHTLY_UTC.minute).padStart(2, "0");
    expect(readFileSync("TESTING.md", "utf8")).toContain(`${hh}:${mm} UTC`);
  });
});
