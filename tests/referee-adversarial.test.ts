import { describe, expect, it } from "vitest";
import { ADVERSARIAL, ADVERSARIAL_BILL, runAdversarial } from "@/lib/review/adversarial";
import { checkVote, routeForDecision } from "@/lib/review/referee";

/**
 * The recorded adversarial set (src/lib/review/adversarial.ts): reviewer outputs a model could send and must not be
 * trusted, run through the same referee and router the API uses, against the real rulebook passages. The referee
 * rejects a quote that is not in its passage, a passage from the other rulebook and a citation that does not exist,
 * abstains when the two reviewers disagree, and in every case the route keeps her check whole.
 */
describe("the referee's adversarial set", () => {
  const rows = runAdversarial();
  const whole = routeForDecision(ADVERSARIAL_BILL, "not_shelter").check as number;

  it("covers the four ways a reviewer can be wrong, and a control", () => {
    expect(ADVERSARIAL.map((c) => c.id)).toEqual(["control", "wrong-quote", "wrong-rulebook", "fabricated-citation", "disagree"]);
  });

  it("the honest pair is accepted: both quotes are found word for word in their own rulebooks", () => {
    const control = rows.find((r) => r.id === "control")!;
    expect(control.decision.votes.every((v) => v.valid)).toBe(true);
    expect(control.decision.decision).toBe("shelter");
    expect(control.routed.route).toBe("able");
  });

  it("each case ends as expected: the set-aside count, the decision and the route", () => {
    for (const r of rows) {
      expect({ id: r.id, decision: r.decision.decision, setAside: r.decision.votes.filter((v) => !v.valid).length, route: r.routed.route }).toEqual({ id: r.id, ...r.expect });
    }
  });

  it("names the reason each untrusted output was set aside", () => {
    const by = (id: string) => rows.find((r) => r.id === id)!.decision.votes.find((v) => !v.valid)!;
    expect(by("wrong-quote").setAsideReason).toMatch(/word for word/);
    expect(by("wrong-rulebook").setAsideReason).toMatch(/other reviewer/);
    expect(by("fabricated-citation").setAsideReason).toMatch(/not in any rulebook/);
    expect(rows.find((r) => r.id === "disagree")!.decision.summary).toMatch(/either reading/);
  });

  it("keeps her check whole in every case, including the ones where a reviewer was wrong", () => {
    for (const r of rows) {
      expect(r.check, r.id).toBe(whole);
      expect(r.checkWhole, r.id).toBe(true);
      expect(r.ifPaidShop).toBeLessThan(whole);
    }
  });

  it("a fabricated citation is not rescued by a right answer", () => {
    const fabricated = ADVERSARIAL.find((c) => c.id === "fabricated-citation")!.reviews[0];
    expect(fabricated.answer).toBe("shelter");
    expect(checkVote(fabricated).valid).toBe(false);
  });
});
