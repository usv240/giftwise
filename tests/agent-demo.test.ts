import { describe, expect, it } from "vitest";
import recorded from "../content/agent-demo.json";
import { today } from "@/lib/api/envelope";
import { CASH_EXAMPLE_USD, SAMPLE, cashExample } from "@/lib/households";
import { DEFAULT_PROFILE, RATE_YEARS, fbr, usd, type Profile } from "@/lib/rules";

/**
 * /agents shows a recorded assistant run; /g/maya computes the same $300 cash gift live. When the federal rate changes
 * (2027 from January), a recording made before the change would name old checks. These tests fail until it is
 * recorded again (scripts/record-agent-demo.ts), so the two pages always agree.
 */
type Step = { kind: string; tool?: string; text?: string };
const steps = recorded.steps as Step[];
const profile: Profile = { ...DEFAULT_PROFILE, ...(SAMPLE.profile as Partial<Profile>) };
const cash = cashExample(profile, today());
const resultOf = (tool: string) => steps.find((s) => s.kind === "result" && s.tool === tool)?.text ?? "";
const says = steps.filter((s) => s.kind === "say").map((s) => s.text ?? "");
const all = steps.map((s) => s.text ?? "").join("\n");

describe("the For agents recording and Maya's gift page", () => {
  it("June asks about the same cash gift the gift page compares with", () => {
    expect(steps[0].kind).toBe("ask");
    expect(steps[0].text).toContain(usd(CASH_EXAMPLE_USD));
  });

  it("the tools answered with the checks the gift page shows today", () => {
    for (const tool of ["check_gift", "plan_gift"]) {
      expect(resultOf(tool), tool).toContain(usd(cash.checkAfter));
      expect(resultOf(tool), tool).toContain(usd(cash.checkBaseline));
    }
  });

  it("the assistant tells June the same two checks", () => {
    const told = says.filter((t) => t.includes(usd(cash.checkAfter)));
    expect(told.length).toBeGreaterThan(0);
    for (const t of told) expect(t).toContain(usd(cash.checkBaseline));
  });

  it("names no check from another year's federal rate", () => {
    const counted = cash.checkBaseline - cash.checkAfter;
    const current = fbr(profile.couple, cash.paymentMonth);
    for (const year of RATE_YEARS) {
      const other = fbr(profile.couple, `${year}-06`);
      if (other === current) continue;
      expect(all, `${year} rate`).not.toContain(usd(other));
      expect(all, `${year} rate, after cash`).not.toContain(usd(other - counted));
    }
  });
});
