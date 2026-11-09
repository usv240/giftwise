import { beforeEach, describe, expect, it, vi } from "vitest";
import recorded from "../content/reviews/electric-bill-read.json";

/**
 * The live AI step on the preset page, with Claude and the database mocked: live under the budget; with no key or the
 * budget spent, Claude's recorded answer replayed through the same reader; the saved reading when there is none.
 */
const state = vi.hoisted(() => ({ key: true, spent: 0, calls: 0, replays: 0, fail: false, recording: true }));

vi.mock("@/lib/ai/claude", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/claude")>()), aiAvailable: () => state.key, AI_DAILY_CAP_USD: 2 }));
vi.mock("@/lib/ai/tasks", async () => {
  const { AiUnavailableError } = await import("@/lib/ai/claude");
  return {
    readBill: async (_file: unknown, how: { replayOnly?: boolean } = {}) => {
      if (how.replayOnly) {
        state.replays += 1;
        if (!state.recording) throw new AiUnavailableError();
        return { data: recorded.data, usage: null, model: recorded.model, replayed: true, recordedAt: recorded.recorded_at };
      }
      state.calls += 1;
      if (state.fail) throw new Error("upstream");
      return { data: { ...recorded.data, amount_due: 150 }, usage: {}, model: "claude-opus-5-5", replayed: false };
    },
  };
});
vi.mock("@/lib/db", () => ({ dbConfigured: () => true, db: () => ({ execute: async () => ({ rows: [{ cost: String(state.spent) }] }) }) }));

import { sampleBillRead } from "@/lib/ai/sample-bill";

describe("Read this bill live", () => {
  beforeEach(() => Object.assign(state, { key: true, spent: 0, calls: 0, replays: 0, fail: false, recording: true }));

  it("reads live under the day's budget, and the rules engine prices what Claude read", async () => {
    const r = await sampleBillRead();
    expect(r.mode).toBe("live");
    expect([state.calls, state.replays]).toEqual([1, 0]);
    expect(r.bill.amount_due).toBe(150);
    expect(r.check.month).toBe("June 2026");
    expect(r.check.through_able).toBe(994);
    expect(r.check.paid_to_company).toBeLessThan(994);
  });

  it("with no key, replays Claude's recorded answer through the same reader, labelled", async () => {
    state.key = false;
    const r = await sampleBillRead();
    expect([r.mode, r.reason, state.calls, state.replays]).toEqual(["replayed", "no_key", 0, 1]);
    expect(r.read_at).toBe(recorded.recorded_at);
    expect(r.check).toMatchObject({ month: "June 2026", paid_to_company: 876, through_able: 994 });
  });

  it("replays once the day's spend reaches the budget, and makes no live call", async () => {
    state.spent = 2.01;
    const r = await sampleBillRead();
    expect([r.mode, r.reason, state.calls, state.replays]).toEqual(["replayed", "budget", 0, 1]);
    expect(r.budget).toEqual({ spent_today: 2.01, cap: 2 });
  });

  it("shows the saved reading, saying why, on a checkout without the recording", async () => {
    state.key = false;
    state.recording = false;
    const r = await sampleBillRead();
    expect([r.mode, r.reason, state.calls]).toEqual(["recorded", "no_key", 0]);
    expect(r.read_at).toBe(recorded.recorded_at);
  });

  it("falls back to the saved reading when the live call fails", async () => {
    state.fail = true;
    const r = await sampleBillRead();
    expect([r.mode, r.reason]).toEqual(["recorded", "error"]);
  });
});
