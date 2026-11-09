import { describe, expect, it } from "vitest";
import { SAMPLE } from "@/lib/households";
import { giftText, receiptText } from "@/lib/i18n/gift";
import { byPayee, distinctPayees, routeGift } from "@/lib/routing";
import { DEFAULT_PROFILE } from "@/lib/rules";
import { RECORDED_RECEIPT } from "@/lib/sample-receipt";

/** Every count of recipients a person reads counts payees: her ABLE account paid on two lines is one recipient. */
describe("recipients are payees", () => {
  const needs = SAMPLE.needs.map((n, i) => ({ id: i + 1, title: n.title, category: n.category, route: n.route, payeeName: n.payeeName, payeeAccount: n.payeeAccount, amount: Number(n.amount), funded: 0, recurring: n.recurring }));
  const plan = routeGift(1500, needs, "2026-11-10", { ...DEFAULT_PROFILE, ...SAMPLE.profile }, "Maya's ABLE account");

  it("$1,500 on the sample page is five lines to four payees, and the giving card says PayPal pays all 4", () => {
    expect(plan.lines).toHaveLength(5);
    expect(distinctPayees(plan.lines)).toEqual(["Riverside Mobility Repair", "Eastgate College Bookstore", "Maya's ABLE account", "Northside Physical Therapy"]);
    expect(giftText("en").payRest(distinctPayees(plan.lines).length, "x")).toContain("PayPal pays all 4 directly");
  });

  it("the preview lists her ABLE account once, with both things it is paid for and their total", () => {
    const rows = byPayee(plan.lines);
    expect(rows.map((r) => r.payeeName)).toEqual(distinctPayees(plan.lines));
    const able = rows.find((r) => r.payeeName === "Maya's ABLE account")!;
    expect(able.lines.map((l) => l.referenceId)).toEqual(["need-3", "able-savings"]);
    expect(able.amount).toBe(plan.lines.filter((l) => l.route === "able").reduce((s, l) => s + l.amount, 0));
    expect(rows.reduce((s, r) => s + r.amount, 0)).toBeCloseTo(1500, 2);
    expect(giftText("en").joinFor(["Electric bill, this month", "savings for later"])).toBe("Electric bill, this month and savings for later");
  });

  it("the recorded receipt reads three recipients on four lines, in English and Spanish", () => {
    const payees = distinctPayees(RECORDED_RECEIPT.lines.map((l) => ({ payeeName: l.payee_name })));
    expect(payees).toHaveLength(3);
    expect(receiptText("en").sub("John", payees.length, RECORDED_RECEIPT.lines.length, "Nov 8, 2026")).toBe("From John, split across 3 recipients on 4 lines in one PayPal payment on Nov 8, 2026.");
    expect(receiptText("es").sub("John", payees.length, RECORDED_RECEIPT.lines.length, "8 nov 2026")).toContain("repartido entre 3 destinatarios en 4 líneas");
    expect(receiptText("en").sub(undefined, 2, 2, "today")).toBe("split across 2 recipients in one PayPal payment on today.");
  });
});

/** The sample page's note says where its gifts go, and it names her ABLE account because one of its needs is paid there. */
describe("the sample page says where every gift goes", () => {
  it("names the ABLE account when a need is paid to it, in English and Spanish", async () => {
    const { sampleIn } = await import("@/lib/i18n/gift");
    expect(SAMPLE.needs.some((n) => n.route === "able")).toBe(true);
    expect(SAMPLE.note).toContain("paid straight to the shop or clinic, or to her ABLE account");
    expect(SAMPLE.note).not.toMatch(/goes straight to the shop, so/);
    expect(sampleIn("es", SAMPLE.note)).toContain("o a su cuenta ABLE");
  });
});
