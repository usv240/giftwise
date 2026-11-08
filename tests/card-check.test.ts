import { describe, expect, it } from "vitest";
import { CHECK_PAGE, TEST_CARD, cardCheckBlocked, verifySplit, type PayPalOrder, type PlannedUnit } from "@/lib/card-check";
import { SAMPLE } from "@/lib/households";
import { routeGift } from "@/lib/routing";
import { DEFAULT_PROFILE, type Profile } from "@/lib/rules";

const planned: PlannedUnit[] = [
  { referenceId: "need-1", amount: 6, payeeEmail: "riverside@example.com", payeeName: "Riverside Mobility Repair" },
  { referenceId: "need-3", amount: 4, payeeEmail: "able@example.com", payeeName: "Maya's ABLE account" },
  { referenceId: "able-savings", amount: 2, payeeEmail: "able@example.com", payeeName: "Maya's ABLE account" },
];
/** PayPal's copy of an order that paid the plan exactly. */
const paid = (): PayPalOrder => ({
  id: "5O190127TN364715T",
  status: "COMPLETED",
  purchase_units: planned.map((p, i) => ({
    reference_id: p.referenceId,
    amount: { value: p.amount.toFixed(2) },
    payee: { email_address: p.payeeEmail.toUpperCase(), merchant_id: `M${i}` },
    payments: { captures: [{ id: `CAP${i}`, status: "COMPLETED", amount: { value: p.amount.toFixed(2) } }] },
  })),
});

describe("the nightly card check", () => {
  it("passes an order PayPal captured exactly as routed", () => {
    const v = verifySplit(planned, paid());
    expect(v.ok).toBe(true);
    expect(v.problems).toEqual([]);
    expect(v.units.map((u) => [u.reference_id, u.amount, u.capture_id])).toEqual([
      ["need-1", "6.00", "CAP0"],
      ["need-3", "4.00", "CAP1"],
      ["able-savings", "2.00", "CAP2"],
    ]);
  });

  it("catches a unit paid the wrong amount, to the wrong account, or not captured", () => {
    const o = paid();
    o.purchase_units![0].payments!.captures![0].amount = { value: "4.00" };
    o.purchase_units![1].payee = { email_address: "someone-else@example.com" };
    o.purchase_units![2].payments = { captures: [] };
    const v = verifySplit(planned, o);
    expect(v.ok).toBe(false);
    expect(v.problems).toEqual(["need-1: captured 4.00, routed 6.00", "need-3: paid to a different account", "able-savings: 0 captures"]);
  });

  it("catches an order that is not complete, a missing unit, an extra unit and a pending capture", () => {
    const o = paid();
    o.status = "APPROVED";
    o.purchase_units = [o.purchase_units![0], { ...o.purchase_units![1], payments: { captures: [{ id: "C", status: "PENDING", amount: { value: "4.00" } }] } }, { reference_id: "surprise" }];
    const v = verifySplit(planned, o);
    expect(v.ok).toBe(false);
    expect(v.problems).toEqual(["order is APPROVED, not COMPLETED", "units not routed: surprise", "need-3: capture PENDING", "able-savings: missing at PayPal"]);
  });

  it("routes its small gift across every sample need and her ABLE savings, keeping her check whole", () => {
    const profile: Profile = { ...DEFAULT_PROFILE, ...SAMPLE.profile };
    const needs = SAMPLE.needs.map((n, i) => ({ id: i + 1, title: n.title, category: n.category, route: n.route, payeeName: n.payeeName, payeeAccount: n.payeeAccount, amount: Number(CHECK_PAGE.amounts[i]), funded: 0, recurring: n.recurring }));
    const plan = routeGift(CHECK_PAGE.gift, needs, "2026-11-07", profile);
    expect(plan.lines.map((l) => [l.payeeAccount, l.amount])).toEqual([
      ["vendor:riverside", 30],
      ["vendor:eastgate", 25],
      ["able", 20],
      ["vendor:northside", 15],
      ["able", 10],
    ]);
    expect(plan.unplaced).toBe(0);
    expect(plan.checkWithRouting).toBe(plan.baseline);
    expect(plan.checkIfCash).toBeLessThan(plan.baseline);
  });

  it("runs only in PayPal's sandbox, so it never moves real money", () => {
    expect(cardCheckBlocked("sandbox")).toBeNull();
    expect(cardCheckBlocked("live")).toMatch(/only while PAYPAL_ENV is sandbox/);
  });

  it("pays with a card number PayPal publishes for sandbox testing, and keeps its page out of public lists", () => {
    // developer.paypal.com/tools/sandbox/card-testing lists 4012888888881881 among its Visa test cards.
    expect(TEST_CARD.number).toBe("4012888888881881");
    const luhn = [...TEST_CARD.number].reverse().reduce((s, d, i) => s + (i % 2 ? [0, 2, 4, 6, 8, 1, 3, 5, 7, 9][Number(d)] : Number(d)), 0);
    expect(luhn % 10).toBe(0);
    expect(Number(TEST_CARD.expiry.slice(0, 4))).toBeGreaterThan(2026);
    // /organizations leaves out the test suites' own pages (organizer "E2E"); the sample's own slug stays Maya's.
    expect(CHECK_PAGE.organizer).toBe("E2E");
    expect(CHECK_PAGE.slug).not.toBe(SAMPLE.slug);
  });
});
