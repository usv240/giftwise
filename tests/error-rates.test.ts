import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import ssaRun from "../content/eval/ssa-examples-results.json";
import fieldRun from "../content/eval/field-cases-results.json";
import billRun from "../content/eval-results.json";
import { ERROR_RATES as E } from "@/lib/error-rates";

const of = (t: { errors: number; of: number }) => `${t.errors} of ${t.of}`;

describe("the two error rates on /evidence", () => {
  it("every case with a known answer lands in exactly one rate", () => {
    const by = Object.fromEntries(E.sources.map((s) => [s.id, s.lowered.of + s.held.of]));
    expect(by.ssa).toBe(ssaRun.summary.cases);
    expect(by.court).toBe(fieldRun.summary.scored);
    expect(by.bills).toBe(billRun.negative_control.clear_bills);
    expect(E.contestedBills).toBe(billRun.negative_control.contested_bills);
    expect(E.lowered.of + E.held.of).toBe(ssaRun.summary.cases + fieldRun.summary.scored + billRun.negative_control.clear_bills);
  });

  it("a bill let through as given that should have been rerouted is what the eval run calls a wrong route", () => {
    const bills = E.sources.find((s) => s.id === "bills")!;
    const clearWrong = billRun.negative_control.wrong_routes_on_clear_bills;
    expect(bills.lowered.errors).toBe(clearWrong.referee);
    expect(E.billsWithoutRulebook.lowered.errors).toBe(clearWrong.baseline);
  });

  it("the README states the same two rates", () => {
    const readme = readFileSync("README.md", "utf8");
    expect(readme).toContain(`**${of(E.lowered)}**`);
    expect(readme).toContain(`**${of(E.held)}**`);
  });
});
