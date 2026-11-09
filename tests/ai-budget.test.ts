import { beforeEach, describe, expect, it, vi } from "vitest";

/** The line beside each live AI step: today's spend against the cap, and whether the next run is live or replayed. */
const state = vi.hoisted(() => ({ key: true, spent: 0, recordings: true }));

vi.mock("@/lib/ai/claude", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/claude")>()),
  AI_DAILY_CAP_USD: 2,
  aiMode: async () => (state.key ? "live" : state.recordings ? "replay" : "off"),
}));
vi.mock("@/lib/db", () => ({ dbConfigured: () => true, db: () => ({ execute: async () => ({ rows: [{ cost: String(state.spent) }] }) }) }));

import { aiBudget } from "@/lib/ai/budget";
import { budgetLine } from "@/components/try/AiBudget";

describe("the AI budget beside each live step", () => {
  beforeEach(() => Object.assign(state, { key: true, spent: 0, recordings: true }));

  it("says the next run is live, with what is left of the cap", async () => {
    state.spent = 0.42;
    const b = await aiBudget();
    expect(b).toMatchObject({ next: "live", why: null, cap: 2, left: 1.58 });
    expect(budgetLine(b).text).toBe("The next run is live. Today's AI budget: $1.58 of $2.00 left.");
  });

  it("says the samples replay once the cap is spent, and does not change the cap", async () => {
    state.spent = 2.01;
    const b = await aiBudget();
    expect(b).toMatchObject({ next: "replayed", why: "budget", cap: 2, left: 0 });
    expect(budgetLine(b).tone).toBe("replayed");
  });

  it("says the samples replay with no key, and the saved run shows with no recordings either", async () => {
    state.key = false;
    expect(await aiBudget()).toMatchObject({ next: "replayed", why: "no_key" });
    state.recordings = false;
    expect(await aiBudget()).toMatchObject({ next: "saved", why: "no_key" });
  });

  it("on /agents, where there is no replay, says the recorded run stays in view", async () => {
    state.key = false;
    expect(budgetLine(await aiBudget(), true).text).toBe("No AI key on this server, so the recorded run stays in view.");
  });
});
