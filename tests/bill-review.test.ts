import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PASSAGES } from "@/lib/review/referee";
import { billDescription, reviewReasons, type ReadBill } from "@/lib/review/bill-route";

/**
 * A bill read by Claude goes to the two reviewers whenever it sits at or near housing, or the reading is unsure, and
 * the referee decides its route. The model is mocked: each reviewer answers from a script, quoting its own rulebook.
 */

type Scripted = "shelter" | "not_shelter" | "unclear" | "fail";
const ai = vi.hoisted(() => ({ regs: "shelter" as Scripted, poms: "shelter" as Scripted, calls: 0, failWith: null as Error | null }));

vi.mock("@/lib/ai/claude", async (orig) => {
  const real = await orig<typeof import("@/lib/ai/claude")>();
  return {
    ...real,
    structured: vi.fn(async (o: { system: string }) => {
      ai.calls++;
      const authority = o.system.includes("Regulations reviewer") ? "regs" : "poms";
      const answer = ai[authority];
      if (answer === "fail") throw ai.failWith ?? new real.AiUnavailableError();
      // Quote the first passage of the reviewer's own rulebook, word for word, so the referee counts the vote.
      const p = PASSAGES.find((x) => x.authority === authority && x.text.length > 80)!;
      return {
        data: { answer, passage_id: p.id, quote: p.text.slice(0, 80), reason_plain: "Scripted answer.", reason_technical: "Scripted for the test.", confidence: 0.9 },
        usage: {},
        model: "claude-opus-5-5",
      };
    }),
  };
});

const bill = (o: Partial<ReadBill>): ReadBill => ({ vendor_name: "Riverside Mobility Repair", vendor_category: "equipment", amount_due: 150, due_date: "2026-11-20", confidence: 0.96, line_items: [{ description: "Wheelchair brake adjustment", amount: 150 }], ...o });
const water = bill({ vendor_name: "Cedar Valley Water District", vendor_category: "other", line_items: [{ description: "Residential water and sewer service", amount: 150 }] });

describe("which bills go to the two reviewers", () => {
  it("a confident reading away from housing is routed on its own", () => {
    expect(reviewReasons(bill({}))).toEqual([]);
  });
  it("a category at or next to housing goes to them", () => {
    expect(reviewReasons(bill({ vendor_name: "Northside Electric Co-op", vendor_category: "utility", line_items: [] }))[0]).toMatch(/utility bill/);
    expect(reviewReasons(bill({ vendor_name: "Valley Fiber", vendor_category: "internet", line_items: [] }))[0]).toMatch(/internet bill/);
  });
  it("housing words in the vendor or a line item send it, whatever the category read", () => {
    expect(reviewReasons(water)).toEqual(["The bill mentions water or sewer."]);
    expect(reviewReasons(bill({ vendor_name: "Oak Park HOA", vendor_category: "other", line_items: [{ description: "Quarterly dues", amount: 150 }] }))[0]).toMatch(/HOA/);
    expect(reviewReasons(bill({ vendor_category: "other", line_items: [{ description: "Security deposit", amount: 150 }] }))[0]).toMatch(/a deposit/);
    expect(reviewReasons(bill({ vendor_name: "Allied Renters Insurance", vendor_category: "other", line_items: [] }))[0]).toMatch(/insurance/);
    expect(reviewReasons(bill({ vendor_name: "Metro Waste", vendor_category: "other", line_items: [{ description: "Trash and recycling pickup", amount: 150 }] }))[0]).toMatch(/trash/);
  });
  it("a reading under 90% sure goes to them", () => {
    expect(reviewReasons(bill({ confidence: 0.82 }))).toEqual(["Claude was 82% sure of its reading, under the 90% Giftwise asks for."]);
  });
  it("the reviewers read the vendor and every line item", () => {
    expect(billDescription(water)).toBe("Cedar Valley Water District. Residential water and sewer service: $150");
  });
});

describe("the referee decides the route of a bill near housing", () => {
  let routeReadBill: typeof import("@/lib/ai/bill-review").routeReadBill;
  // The first import loads the Anthropic SDK behind the mock, which can take a while on a cold machine.
  beforeAll(async () => {
    ({ routeReadBill } = await import("@/lib/ai/bill-review"));
  }, 120_000);
  beforeEach(() => {
    ai.calls = 0;
    ai.failWith = null;
  });
  const route = (b: ReadBill) => routeReadBill(b, "2026-11-07");

  it("a water bill read as 'other': both reviewers find it a housing cost, so it goes to her ABLE account", async () => {
    ai.regs = "shelter";
    ai.poms = "shelter";
    const { route: r, review } = await route(water);
    expect(ai.calls).toBe(2);
    expect(r.decided_by).toBe("reviewers");
    expect(r.decision).toBe("shelter");
    expect(r.delivery).toBe("able");
    expect(review?.referee.agreed).toBe(true);
    expect(review?.reviews.every((v) => v.quote_checked)).toBe(true);
    // On its one reading ("other"), paying the water district would have looked fine.
    const { evaluateGift, DEFAULT_PROFILE } = await import("@/lib/rules");
    const single = evaluateGift({ id: "w", date: "2026-11-20", amount: 150, delivery: "vendor", category: "other" }, DEFAULT_PROFILE);
    expect(r.check_after).toBe(single.checkAfter);
    expect(evaluateGift({ id: "w", date: "2026-11-20", amount: 150, delivery: "vendor", category: "utility" }, DEFAULT_PROFILE).checkAfter).toBeLessThan(r.check_after!);
  });

  it("when the reviewers read it differently, the route keeps her check whole under either reading", async () => {
    ai.regs = "shelter";
    ai.poms = "not_shelter";
    const { route: r } = await route(water);
    expect(r.decided_by).toBe("reviewers");
    expect(r.decision).toBe("unsure");
    expect(r.readings).toEqual(["utility", "other"]);
    expect(r.delivery).toBe("able");
  });

  it("an internet bill both find is not a housing cost is paid to the company", async () => {
    ai.regs = "not_shelter";
    ai.poms = "not_shelter";
    const { route: r } = await route(bill({ vendor_name: "Valley Fiber", vendor_category: "internet", line_items: [{ description: "Home internet, 300 Mbps", amount: 150 }] }));
    expect([r.decided_by, r.decision, r.delivery]).toEqual(["reviewers", "not_shelter", "vendor"]);
  });

  it("when the AI is unavailable for the reviewers, the bill still gets the route that is safe under either reading", async () => {
    ai.regs = "fail";
    ai.poms = "fail";
    const { route: r, review } = await route(water);
    expect(review).toBeNull();
    expect(r.decided_by).toBe("both_readings");
    expect(r.delivery).toBe("able");
    expect(r.note).toMatch(/could not run/);
  });

  it("a refused answer falls back the same way", async () => {
    const { AiRefusedError } = await import("@/lib/ai/claude");
    ai.regs = "shelter";
    ai.poms = "fail";
    ai.failWith = new AiRefusedError("refused");
    const { route: r } = await route(water);
    expect([r.decided_by, r.delivery]).toEqual(["both_readings", "able"]);
  });

  it("a confident equipment bill makes no reviewer call and is paid to the shop", async () => {
    const { route: r, review } = await route(bill({}));
    expect(ai.calls).toBe(0);
    expect(review).toBeNull();
    expect([r.decided_by, r.decision, r.delivery]).toEqual(["reading", "not_shelter", "vendor"]);
  });
});
