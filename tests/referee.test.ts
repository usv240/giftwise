import { describe, expect, it } from "vitest";
import { checkVote, referee, routeForDecision, type Passage, type Review } from "@/lib/review/referee";
import type { Gift } from "@/lib/rules";

// Sample passages for the referee's logic only; the real rulebook text lives in content/authorities.json.
const P: Passage[] = [
  { id: "regs-shelter", authority: "regs", cite: "Sample regulation", url: "https://example.gov/regs", text: "Shelter includes room, rent, mortgage payments, real property taxes, heating fuel, gas, electricity, water, sewerage, and garbage collection services." },
  { id: "poms-shelter", authority: "poms", cite: "Sample manual", url: "https://example.gov/poms", text: "Shelter costs include rent, mortgage payments, property taxes, heating fuel, gas, electricity, water, sewer, and garbage removal." },
];

const vote = (o: Partial<Review>): Review => ({
  authority: "regs",
  answer: "shelter",
  passage_id: "regs-shelter",
  quote: "Shelter includes room, rent, mortgage payments, real property taxes, heating fuel, gas, electricity",
  reason_plain: "Electricity is listed as shelter.",
  reason_technical: "The passage lists electricity.",
  confidence: 0.9,
  ...o,
});

const regsYes = vote({});
const pomsYes = vote({ authority: "poms", passage_id: "poms-shelter", quote: "Shelter costs include rent, mortgage payments, property taxes, heating fuel, gas, electricity, water" });
const electric: Gift = { id: "e", date: "2026-04-10", amount: 138, delivery: "vendor", category: "utility", recurring: true };

describe("checkVote", () => {
  it("accepts a word-for-word quote from the reviewer's own rulebook", () => {
    expect(checkVote(regsYes, P).valid).toBe(true);
  });
  it("ignores spacing and curly quotes when comparing", () => {
    expect(checkVote(vote({ quote: "“Shelter  includes room,\n rent, mortgage payments”" }), P).valid).toBe(true);
  });
  it("sets aside a quote that is not in the passage", () => {
    const v = checkVote(vote({ quote: "Electric bills paid by family are never counted as income." }), P);
    expect(v.valid).toBe(false);
    expect(v.setAsideReason).toMatch(/word for word/);
  });
  it("sets aside a passage from the other reviewer's rulebook", () => {
    expect(checkVote(vote({ passage_id: "poms-shelter", quote: pomsYes.quote }), P).setAsideReason).toMatch(/other reviewer/);
  });
  it("sets aside a passage that does not exist", () => {
    expect(checkVote(vote({ passage_id: "made-up" }), P).valid).toBe(false);
  });
  it("sets aside a quote too short to check", () => {
    expect(checkVote(vote({ quote: "electricity" }), P).valid).toBe(false);
  });
});

describe("referee", () => {
  it("acts when both checked answers agree", () => {
    const r = referee([regsYes, pomsYes], P);
    expect(r.agreed).toBe(true);
    expect(r.decision).toBe("shelter");
  });
  it("is unsure when the reviewers disagree", () => {
    const r = referee([regsYes, { ...pomsYes, answer: "not_shelter" }], P);
    expect(r.decision).toBe("unsure");
    expect(r.summary).toMatch(/either reading/);
  });
  it("is unsure when one answer's quote does not check out", () => {
    const r = referee([regsYes, { ...pomsYes, quote: "Utility bills are never shelter when a sister pays them." }], P);
    expect(r.decision).toBe("unsure");
    expect(r.votes[1].valid).toBe(false);
    expect(r.summary).toMatch(/set aside/);
  });
  it("is unsure when a reviewer answers unclear", () => {
    expect(referee([regsYes, { ...pomsYes, answer: "unclear" }], P).decision).toBe("unsure");
  });
});

describe("routeForDecision", () => {
  it("shelter: paying the company would lower her check, so the ABLE account keeps it at $994", () => {
    const r = routeForDecision(electric, "shelter");
    expect(r.routes.find((x) => x.delivery === "vendor")?.check).toBe(876);
    expect(r.route).toBe("able");
    expect(r.check).toBe(994);
  });
  it("not shelter: paying the company directly keeps $994", () => {
    const r = routeForDecision(electric, "not_shelter");
    expect(r.route).toBe("vendor");
    expect(r.check).toBe(994);
  });
  it("unsure: picks the route that keeps her check whole under either reading", () => {
    const r = routeForDecision(electric, "unsure");
    expect(r.readings).toEqual(["utility", "other"]);
    expect(r.route).toBe("able");
    expect(r.check).toBe(994);
  });
});
